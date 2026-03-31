# Script pour ajouter l'initialisation du superviseur QFlush dans start()

$serverFile = Join-Path $PSScriptRoot "server.cjs"

Write-Host "[QFLUSH] Backup du fichier server.cjs..." -ForegroundColor Cyan
Copy-Item $serverFile "$serverFile.before-supervisor-init" -Force

Write-Host "[QFLUSH] Lecture du fichier..." -ForegroundColor Cyan
$lines = Get-Content $serverFile

# Trouver la ligne de la fonction start()
$startIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*async function start\(\)') {
        $startIdx = $i
        Write-Host "[QFLUSH] Fonction start() trouvée à la ligne $startIdx" -ForegroundColor Green
        break
    }
}

if ($startIdx -eq -1) {
    Write-Host "[QFLUSH] ERREUR: Fonction start() non trouvée!" -ForegroundColor Red
    exit 1
}

# Trouver la première ligne après l'ouverture de la fonction (après le {)
$insertIdx = $startIdx + 1
while ($insertIdx -lt $lines.Count -and $lines[$insertIdx] -notmatch '\{') {
    $insertIdx++
}
$insertIdx++ # Juste après le {

# Vérifier si l'initialisation n'existe pas déjà
$alreadyExists = $false
for ($i = $insertIdx; $i -lt [Math]::Min($insertIdx + 30, $lines.Count); $i++) {
    if ($lines[$i] -match 'setupA11Supervisor|qflushSupervisor\s*=') {
        $alreadyExists = $true
        Write-Host "[QFLUSH] L'initialisation existe déjà - skip" -ForegroundColor Yellow
        break
    }
}

if (-not $alreadyExists) {
    Write-Host "[QFLUSH] Ajout de l'initialisation du superviseur..." -ForegroundColor Cyan
    
    # Code à insérer
    $initCode = @(
        "  console.log('[Server] start() function called');",
        "",
        "  // Initialize QFlush supervisor if available",
        "  let qflushSupervisor = null;",
        "  if (QFLUSH_AVAILABLE) {",
        "    console.log('[Server] Initializing QFlush supervisor...');",
        "    try {",
        "      qflushSupervisor = qflushIntegration.setupA11Supervisor();",
        "      if (qflushSupervisor) {",
        "        console.log('[Server] QFlush supervisor initialized successfully');",
        "        globalThis.__A11_QFLUSH_SUPERVISOR = qflushSupervisor;",
        "        ",
        "        // Start all registered services",
        "        const status = qflushIntegration.getStatus(qflushSupervisor);",
        "        if (status && status.processes) {",
        "          Object.keys(status.processes).forEach(serviceName => {",
        "            console.log(`[Server] Starting service: `+serviceName);",
        "            try {",
        "              qflushIntegration.startProcess(qflushSupervisor, serviceName);",
        "            } catch (err) {",
        "              console.error(`[Server] Failed to start `+serviceName+`:`, err.message);",
        "            }",
        "          });",
        "        }",
        "      }",
        "    } catch (err) {",
        "      console.error('[Server] Failed to initialize QFlush supervisor:', err.message);",
        "    }",
        "  } else {",
        "    console.log('[Server] QFlush not available - services will not be auto-managed');",
        "  }",
        ""
    )
    
    # Insérer le code
    $newLines = @()
    $newLines += $lines[0..($insertIdx - 1)]
    $newLines += $initCode
    $newLines += $lines[$insertIdx..($lines.Count - 1)]
    
    # Sauvegarder
    Set-Content $serverFile -Value $newLines
    Write-Host "[QFLUSH] ✅ Initialisation ajoutée avec succès!" -ForegroundColor Green
    Write-Host "[QFLUSH] Le superviseur démarrera automatiquement les services configurés" -ForegroundColor Green
} else {
    Write-Host "[QFLUSH] ℹ Aucune modification nécessaire" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Prochaine étape: Redémarrer le serveur" -ForegroundColor Cyan
Write-Host ("  cd " + $PSScriptRoot) -ForegroundColor White
Write-Host "  node server.cjs" -ForegroundColor White
