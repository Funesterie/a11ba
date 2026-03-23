<#
PowerShell installer for QFLUSH
Supports:
 - user install (default): copies package to %APPDATA% and adds to PATH for current user
 - system install: copies package to C:\Program Files\Funesterie\QFlush and adds to system PATH (requires elevation)
 - npm global install: runs `npm install -g @funeste38/qflush` if package is published

Usage:
 .\install-qflush.ps1 -Mode user
 .\install-qflush.ps1 -Mode system
 .\install-qflush.ps1 -Mode npm
#>
param(
    [ValidateSet('user','system','npm')]
    [string]$Mode = 'user'
)

function Add-PathUser {
    param([string]$dir)
    $current = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($current -notlike "*${dir}*") {
        [Environment]::SetEnvironmentVariable('PATH', "$current;$dir", 'User')
        Write-Host "Added $dir to user PATH"
    } else {
        Write-Host "$dir already in user PATH"
    }
}

function Add-PathMachine {
    param([string]$dir)
    $current = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
    if ($current -notlike "*${dir}*") {
        [Environment]::SetEnvironmentVariable('PATH', "$current;$dir", 'Machine')
        Write-Host "Added $dir to machine PATH"
    } else {
        Write-Host "$dir already in machine PATH"
    }
}

if ($Mode -eq 'npm') {
    Write-Host "Installing via npm global..."
    npm install -g @funeste38/qflush
    exit $?
}

# assume script run from repo root or from extracted package
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$source = Join-Path $scriptDir '..' 'dist'

if ($Mode -eq 'user') {
    $dest = Join-Path $env:APPDATA 'Funeste38\QFlush'
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Path "$scriptDir\..\dist\*" -Destination $dest -Recurse -Force
    Add-PathUser -dir $dest
    Write-Host "Installed QFLUSH to $dest (user)"
    exit 0
}

if ($Mode -eq 'system') {
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "System install requires elevation. Run PowerShell as Administrator."
        exit 1
    }
    $dest = 'C:\Program Files\Funesterie\QFlush'
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Path "$scriptDir\..\dist\*" -Destination $dest -Recurse -Force
    Add-PathMachine -dir $dest
    Write-Host "Installed QFLUSH to $dest (system)"
    exit 0
}
