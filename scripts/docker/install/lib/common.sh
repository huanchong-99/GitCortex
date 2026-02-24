#!/usr/bin/env bash
set -euo pipefail

# Guard against multiple sourcing
if [[ -n "${_GITCORTEX_COMMON_SH_LOADED:-}" ]]; then
    return 0 2>/dev/null || exit 0
fi
readonly _GITCORTEX_COMMON_SH_LOADED=1

# --- Logging ---

log_info()  { printf '[INFO]  %s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
log_warn()  { printf '[WARN]  %s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
log_error() { printf '[ERROR] %s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }

# --- Utilities ---

require_command() {
    command -v "$1" >/dev/null 2>&1 || { log_error "Required command not found: $1"; exit 1; }
}

# --- npm install with retry + exponential backoff ---

npm_install_global() {
    local pkg="$1"
    local max_retries="${2:-3}"
    local attempt=0
    local backoff=2

    require_command npm

    while (( attempt < max_retries )); do
        attempt=$((attempt + 1))
        log_info "Installing $pkg (attempt $attempt/$max_retries)..."
        if npm install -g --no-audit --no-fund "$pkg" 2>&1; then
            log_info "$pkg installed successfully"
            return 0
        fi
        log_warn "$pkg install attempt $attempt failed"
        if (( attempt < max_retries )); then
            log_info "Retrying in ${backoff}s..."
            sleep "$backoff"
            backoff=$((backoff * 2))
        fi
    done

    log_error "Failed to install $pkg after $max_retries attempts"
    return 1
}

# --- CLI verification (no eval, direct execution) ---

verify_cli() {
    local name="$1"
    shift
    local output

    if output=$("$@" 2>&1); then
        local version="${output%%$'\n'*}"
        version="${version:-unknown}"
        log_info "OK $name: $version"
        return 0
    else
        log_warn "MISSING $name"
        return 1
    fi
}
