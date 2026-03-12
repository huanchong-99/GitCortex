#Requires -Version 5.1
param(
    [string]$Tier = "repo",
    [string]$Mode = "shadow"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "../..")

Write-Host "=== GitCortex Quality Gate ==="
Write-Host "Project root: $ProjectRoot"
Write-Host "Tier: $Tier"
Write-Host "Mode: $Mode"
Write-Host ""

Set-Location $ProjectRoot

# Run the quality engine via cargo
cargo run --package quality -- `
  --project-root "$ProjectRoot" `
  --tier $Tier `
  --mode $Mode

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Quality gate completed successfully."
} else {
    Write-Host ""
    Write-Host "Quality gate failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
}
