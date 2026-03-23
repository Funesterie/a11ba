$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$base = Resolve-Path (Join-Path $scriptRoot '..')
$logDir = Join-Path $base '.qflash\logs'
if (-not (Test-Path $logDir)) { Write-Output "NO_QFLASH_LOGS_FOUND: $logDir"; exit 0 }
$files = Get-ChildItem -Path $logDir -Filter '*.log' -ErrorAction SilentlyContinue
if (-not $files) { Write-Output "NO_LOG_FILES"; exit 0 }
$jobs = @()
foreach ($f in $files) {
    $jobs += Start-Job -ScriptBlock { param($p) Get-Content -Path $p -Wait } -ArgumentList $f.FullName
}
Write-Output "STARTED_TAILING: $($files | ForEach-Object { $_.Name } -join ', ')"
Start-Sleep -Seconds 30
Write-Output "STOPPING_JOBS"
foreach ($j in $jobs) { Stop-Job $j | Out-Null }
foreach ($j in $jobs) {
    Write-Output "--- JOB OUTPUT ---"
    Receive-Job $j
}
foreach ($j in $jobs) { Remove-Job $j }
Write-Output "DONE"
