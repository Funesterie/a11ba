# PowerShell installer for qflushd (Windows service wrapper)
# This is an example; for production use consider NSSM or sc.exe wrapper.

Write-Host "This script downloads qflush and registers qflushd as a scheduled task or service."
Write-Host "Manual step: create a Windows service pointing to 'node dist/daemon/qflushd.js' using nssm or sc.exe."

# Example using nssm (assuming nssm.exe is available):
# nssm install qflushd "C:\Program Files\nodejs\node.exe" "C:\path\to\qflush\dist\daemon\qflushd.js"

Write-Host "Install instructions provided."