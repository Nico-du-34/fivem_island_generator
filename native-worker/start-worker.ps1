$ErrorActionPreference = "Stop"
$workerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workerDir

if (-not $env:BLENDER_PATH -or -not (Test-Path $env:BLENDER_PATH)) {
    throw "BLENDER_PATH doit pointer vers blender.exe."
}
if (-not $env:ISLAND_EXPORT_BRIDGE_TOKEN -or $env:ISLAND_EXPORT_BRIDGE_TOKEN.Length -lt 32) {
    throw "ISLAND_EXPORT_BRIDGE_TOKEN doit contenir au moins 32 caractères."
}

Write-Host "Island Forge Windows Worker"
Write-Host "Blender : $env:BLENDER_PATH"
Write-Host "Port    : $(if ($env:ISLAND_EXPORT_BRIDGE_PORT) { $env:ISLAND_EXPORT_BRIDGE_PORT } else { '8787' })"
Write-Host "Données : $(if ($env:ISLAND_WORKER_DATA) { $env:ISLAND_WORKER_DATA } else { '.\island-worker-data' })"
node .\server.mjs
