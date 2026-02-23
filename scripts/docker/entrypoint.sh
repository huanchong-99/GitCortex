#!/usr/bin/env bash
set -euo pipefail

echo "=== GitCortex Container Starting ==="

GITCORTEX_ASSET_DIR="${GITCORTEX_ASSET_DIR:-/var/lib/gitcortex/assets}"
GITCORTEX_TEMP_DIR="${GITCORTEX_TEMP_DIR:-/var/lib/gitcortex}"
export GITCORTEX_ASSET_DIR GITCORTEX_TEMP_DIR

mkdir -p "${GITCORTEX_ASSET_DIR}" "${GITCORTEX_TEMP_DIR}"

if ! command -v git > /dev/null 2>&1; then
    echo "FATAL: git not found" >&2
    exit 1
fi

if ! command -v node > /dev/null 2>&1; then
    echo "FATAL: node not found" >&2
    exit 1
fi

echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "git: $(git --version)"
echo "Asset dir: ${GITCORTEX_ASSET_DIR}"
echo "Temp dir: ${GITCORTEX_TEMP_DIR}"

exec "$@"
