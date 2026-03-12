#!/bin/bash
set -e

SCANNER_VERSION="5.0.1.3006"
SCANNER_DIR="$(cd "$(dirname "$0")/../../quality/sonar" && pwd)/scanner"
SCANNER_BIN="$SCANNER_DIR/sonar-scanner-$SCANNER_VERSION-linux/bin/sonar-scanner"

if [ ! -f "$SCANNER_BIN" ]; then
    echo "Downloading SonarScanner..."
    mkdir -p "$SCANNER_DIR"
    curl -sSLo "$SCANNER_DIR/sonar-scanner.zip" "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-$SCANNER_VERSION-linux.zip"
    unzip -q -o "$SCANNER_DIR/sonar-scanner.zip" -d "$SCANNER_DIR"
    rm "$SCANNER_DIR/sonar-scanner.zip"
fi

echo "Running SonarScanner..."
"$SCANNER_BIN" -D"sonar.projectBaseDir=$(cd "$(dirname "$0")/../.." && pwd)" "$@"
