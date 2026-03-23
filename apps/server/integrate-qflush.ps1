# Script to integrate QFlush into server.cjs

$serverFile = "D:\A11\apps\server\server.cjs"
$content = Get-Content $serverFile -Raw

# 1. Add qflush require after nezAuth require
$qflushRequire = "const qflushIntegration = require('./src/qflush-integration.cjs');"
if ($content -notmatch "qflush-integration") {
    $content = $content -replace "(const \{ nezAuth.*?require\('\./src/middleware/nezAuth'\);)", "`$1`n$qflushRequire"
    Write-Host "[QFLUSH] Added qflush-integration require"
}

# 2. Update QFLUSH detection section to use the new integration
$oldQflushSection = @"
// qflush supervisor integration: detect if available \(try module first, then local exe\)
let QFLUSH_AVAILABLE = false;
let QFLUSH_MODULE = null;
let QFLUSH_PATH = null;
try \{
  // prefer requiring a node module named 'qflush' if installed
  QFLUSH_MODULE = require\('qflush'\);
  QFLUSH_AVAILABLE = true;
  console\.log\('\[QFLUSH\] qflush Node module loaded\.'\);
\} catch \(e\) \{
  // fallback: check for a local qflush executable in project folders
  const qflushCandidates = \[
    path\.join\(BASE, '\.qflush', 'qflush\.exe'\),
    path\.join\(BASE, 'qflush', 'qflush\.exe'\),
    path\.join\(BASE, 'bin', 'qflush\.exe'\)
  \];
  for \(const candidate of qflushCandidates\) \{
    try \{
      if \(fs\.existsSync\(candidate\)\) \{
        QFLUSH_PATH = candidate;
        QFLUSH_AVAILABLE = true;
        console\.log\('\[QFLUSH\] Found local qflush executable at', candidate\);
        break;
      \}
    \} catch \(ee\) \{ \}
  \}
  if \(!QFLUSH_AVAILABLE\) \{
    console\.log\('\[QFLUSH\] qflush integration not available\. Skipping\.'\);
  \}
\}

// export for other modules to check
globalThis\.__QFLUSH_AVAILABLE = QFLUSH_AVAILABLE;
globalThis\.__QFLUSH_MODULE = QFLUSH_MODULE;
globalThis\.__QFLUSH_PATH = QFLUSH_PATH;
"@

$newQflushSection = @"
// qflush supervisor integration: using @funeste38/qflush
let QFLUSH_AVAILABLE = qflushIntegration.qflushAvailable;
let QFLUSH_MODULE = QFLUSH_AVAILABLE ? qflushIntegration : null;
let QFLUSH_PATH = null;

if (QFLUSH_AVAILABLE) {
  console.log('[QFLUSH] @funeste38/qflush module loaded successfully');
} else {
  console.log('[QFLUSH] qflush integration not available. Skipping.');
}

// export for other modules to check
globalThis.__QFLUSH_AVAILABLE = QFLUSH_AVAILABLE;
globalThis.__QFLUSH_MODULE = QFLUSH_MODULE;
globalThis.__QFLUSH_PATH = QFLUSH_PATH;
"@

$content = $content -replace $oldQflushSection, $newQflushSection
Write-Host "[QFLUSH] Updated QFLUSH detection section"

# 3. Add QFlush initialization in start() function
$startFuncPattern = "(async function start\(\) \{[^\}]{0,200}console\.log\('\[Server\] start\(\) function called'\);)"
$qflushInit = @"
`$1

  // Initialize QFlush supervisor if available
  let qflushSupervisor = null;
  if (QFLUSH_AVAILABLE) {
    console.log('[Server] Initializing QFlush supervisor...');
    try {
      qflushSupervisor = qflushIntegration.setupA11Supervisor();
      if (qflushSupervisor) {
        console.log('[Server] QFlush supervisor initialized');
        globalThis.__A11_QFLUSH_SUPERVISOR = qflushSupervisor;
      }
    } catch (err) {
      console.error('[Server] Failed to initialize QFlush:', err.message);
    }
  }
"@

if ($content -notmatch "__A11_QFLUSH_SUPERVISOR") {
    $content = $content -replace $startFuncPattern, $qflushInit
    Write-Host "[QFLUSH] Added QFlush initialization in start() function"
}

# 4. Add QFlush status endpoint
$healthEndpoint = @"

// QFlush supervisor status endpoint
app.get('/api/qflush/status', (req, res) => {
  if (!QFLUSH_AVAILABLE) {
    return res.json({ available: false, message: 'QFlush not available' });
  }
  
  try {
    const supervisor = globalThis.__A11_QFLUSH_SUPERVISOR;
    if (!supervisor) {
      return res.json({ available: true, initialized: false, message: 'Supervisor not initialized' });
    }
    
    const status = qflushIntegration.getStatus(supervisor);
    return res.json({ available: true, initialized: true, ...status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
"@

if ($content -notmatch "/api/qflush/status") {
    # Add before the start() function
    $content = $content -replace "(async function start\(\))", "$healthEndpoint`n`$1"
    Write-Host "[QFLUSH] Added QFlush status endpoint"
}

# Save the modified content
Set-Content $serverFile -Value $content -NoNewline
Write-Host "[QFLUSH] Integration complete! Server.cjs updated successfully."
Write-Host ""
Write-Host "You can now:"
Write-Host "  1. Restart the server: node server.cjs"
Write-Host "  2. Check QFlush status: curl http://127.0.0.1:3000/api/qflush/status"
