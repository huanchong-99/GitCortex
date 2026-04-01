#!/usr/bin/env bash
set -euo pipefail

echo "=== SoloDawn Container Starting ==="

SOLODAWN_ASSET_DIR="${SOLODAWN_ASSET_DIR:-/var/lib/solodawn/assets}"
SOLODAWN_TEMP_DIR="${SOLODAWN_TEMP_DIR:-/var/lib/solodawn}"
export SOLODAWN_ASSET_DIR SOLODAWN_TEMP_DIR

mkdir -p "${SOLODAWN_ASSET_DIR}" "${SOLODAWN_TEMP_DIR}"

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
echo "Asset dir: ${SOLODAWN_ASSET_DIR}"
echo "Temp dir: ${SOLODAWN_TEMP_DIR}"

configure_git_safe_directories() {
    local roots_raw roots_normalized
    roots_raw="${SOLODAWN_ALLOWED_ROOTS:-}"
    if [[ -n "${SOLODAWN_WORKSPACE_ROOT:-}" ]]; then
        if [[ -n "${roots_raw}" ]]; then
            roots_raw="${roots_raw},${SOLODAWN_WORKSPACE_ROOT}"
        else
            roots_raw="${SOLODAWN_WORKSPACE_ROOT}"
        fi
    fi

    if [[ -z "${roots_raw}" ]]; then
        return
    fi

    # Normalize separators and configure both root and root/* for nested repositories.
    roots_normalized="${roots_raw//;/,}"
    IFS=',' read -r -a root_items <<< "${roots_normalized}"

    for item in "${root_items[@]}"; do
        local root
        root="$(echo "${item}" | xargs)"
        if [[ -z "${root}" ]]; then
            continue
        fi

        for safe_path in "${root}" "${root%/}/*"; do
            if ! git config --global --get-all safe.directory | grep -Fqx "${safe_path}"; then
                git config --global --add safe.directory "${safe_path}"
            fi
        done
    done

    echo "Configured git safe.directory entries:"
    git config --global --get-all safe.directory | sed 's/^/  - /'
}

configure_git_safe_directories

# ── Pre-exec diagnostics ──
echo "Binary: $(command -v "$1" 2>/dev/null || echo 'NOT FOUND')"
if command -v "$1" >/dev/null 2>&1; then
    ls -la "$(command -v "$1")"
    echo "ELF header (first 4 bytes): $(xxd -l 4 -p "$(command -v "$1")" 2>/dev/null || echo 'xxd not available')"
    echo "Dynamic libs:"
    ldd "$(command -v "$1")" 2>&1 || echo "  ldd failed"
fi
echo "Kernel: $(uname -r)"
echo "Arch: $(uname -m)"
echo "Executing: $*"
echo "─────────────────────────────────"

exec "$@"
