param(
    [Parameter(Mandatory = $true)]
    [string]$YmapPath
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stream = Join-Path $root "stream"
$config = Join-Path $root "config\native-export.json"
$report = Join-Path $root "report\export-report.json"

if (-not (Test-Path $YmapPath -PathType Leaf)) {
    throw "Le fichier YMAP fourni n'existe pas : $YmapPath"
}
$item = Get-Item $YmapPath
if ($item.Length -lt 4096) {
    throw "Le fichier YMAP semble trop petit pour une ressource binaire valide."
}
$bytes = [System.IO.File]::ReadAllBytes($YmapPath)
$header = [System.Text.Encoding]::ASCII.GetString($bytes[0..3])
if ($header -ne "RSC7") {
    throw "Le fichier ne commence pas par l'en-tête RSC7. Enregistre le YMAP en binaire depuis CodeWalker, pas en XML."
}

New-Item -ItemType Directory -Force -Path $stream | Out-Null
$destination = Join-Path $stream (Split-Path -Leaf $YmapPath)
Copy-Item -LiteralPath $YmapPath -Destination $destination -Force

if (-not (Test-Path $config)) {
    throw "config\native-export.json est introuvable. Ce script doit être lancé depuis le dossier de la ressource exportée."
}
$data = Get-Content -Raw -LiteralPath $config | ConvertFrom-Json
$data.nativeReady = $true
$data.manualCodeWalkerFinalizeRequired = $false
$data.finalizedYmap = "stream/" + (Split-Path -Leaf $YmapPath)
$data.finalizedAt = (Get-Date).ToUniversalTime().ToString("o")
$data | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $config -Encoding UTF8

if (Test-Path $report) {
    $reportData = Get-Content -Raw -LiteralPath $report | ConvertFrom-Json
    $reportData.nativeReady = $true
    $reportData.ymapBinary = "stream/" + (Split-Path -Leaf $YmapPath)
    $reportData | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $report -Encoding UTF8
}

Write-Host "YMAP binaire intégré dans stream/."
Write-Host "La ressource est assemblée. Fais un dernier test CodeWalker + FiveM avant déploiement."
