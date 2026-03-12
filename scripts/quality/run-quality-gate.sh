#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TIER="${1:-repo}"
MODE="${2:-shadow}"

echo "=== GitCortex Quality Gate ==="
echo "Project root: $PROJECT_ROOT"
echo "Tier: $TIER"
echo "Mode: $MODE"
echo ""

cd "$PROJECT_ROOT"

# Run the quality engine via cargo
cargo run --package quality -- \
  --project-root "$PROJECT_ROOT" \
  --tier "$TIER" \
  --mode "$MODE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "Quality gate completed successfully."
else
  echo ""
  echo "Quality gate failed with exit code $EXIT_CODE."
fi

exit $EXIT_CODE
