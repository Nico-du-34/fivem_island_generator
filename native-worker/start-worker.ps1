$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Write-Host "Island Forge — démarrage du worker local"
Write-Host "Blender et Sollumz sont détectés automatiquement lorsqu'ils sont installés."
node .\scripts\run-local.mjs worker
