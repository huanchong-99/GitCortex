$ErrorActionPreference = "Stop"

$SCANNER_VERSION = "5.0.1.3006"
$BaseDir = Split-Path -Parent $PSScriptRoot
$SCANNER_DIR = "$BaseDir\..\quality\sonar\scanner"
$SCANNER_BIN = "$SCANNER_DIR\sonar-scanner-$SCANNER_VERSION-windows\bin\sonar-scanner.bat"

if (!(Test-Path $SCANNER_BIN)) {
    Write-Host "Downloading SonarScanner..."
    New-Item -ItemType Directory -Force -Path $SCANNER_DIR | Out-Null
    $ZIP_PATH = "$SCANNER_DIR\sonar-scanner.zip"
    Invoke-WebRequest -Uri "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-$SCANNER_VERSION-windows.zip" -OutFile $ZIP_PATH
    Expand-Archive -Path $ZIP_PATH -DestinationPath $SCANNER_DIR -Force
    Remove-Item $ZIP_PATH
}

Write-Host "Running SonarScanner..."
& $SCANNER_BIN -D"sonar.projectBaseDir=$BaseDir\.." @args
