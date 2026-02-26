#!/usr/bin/env bash
set -euo pipefail

# Guard against multiple sourcing
if [[ -n "${_GITCORTEX_COMMON_SH_LOADED:-}" ]]; then
    return 0 2>/dev/null || exit 0
fi
readonly _GITCORTEX_COMMON_SH_LOADED=1

# --- Logging ---

log_info()  { printf '[INFO]  %s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; return 0; }
log_warn()  { printf '[WARN]  %s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; return 0; }
log_error() { printf '[ERROR] %s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; return 0; }

# --- Utilities ---

require_command() {
    command -v "$1" >/dev/null 2>&1 || { log_error "Required command not found: $1"; exit 1; }
    return 0
}

# --- npm install with retry + exponential backoff ---

sha512_sri_for_file() {
    local file_path="$1"
    node -e 'const fs=require("fs");const crypto=require("crypto");const buf=fs.readFileSync(process.argv[1]);process.stdout.write("sha512-"+crypto.createHash("sha512").update(buf).digest("base64"));' "$file_path"
    return 0
}

npm_install_global() {
    local pkg="$1"
    local max_retries="${2:-3}"
    local attempt=0
    local backoff=2
    local require_integrity="${NPM_REQUIRE_INTEGRITY:-1}"

    require_command npm
    require_command node

    case "${require_integrity,,}" in
        0|false|no|off) require_integrity=0 ;;
        *) require_integrity=1 ;;
    esac

    local requested_spec="$pkg"
    local requested_integrity=""
    if [[ "$requested_spec" == *"#"* ]]; then
        requested_integrity="${requested_spec#*#}"
        requested_spec="${requested_spec%%#*}"
    fi

    while (( attempt < max_retries )); do
        local resolved_name=""
        local resolved_version=""
        local resolved_spec=""
        local expected_integrity=""
        local tmp_dir=""
        local pack_output=""
        local tarball_name=""
        local tarball_path=""
        local actual_integrity=""
        local installed_version=""
        local install_ok=0

        attempt=$((attempt + 1))
        log_info "Resolving $requested_spec (attempt $attempt/$max_retries)..."

        resolved_name="$(npm view "$requested_spec" name 2>/dev/null | tr -d '\r\n' || true)"
        resolved_version="$(npm view "$requested_spec" version 2>/dev/null | tr -d '\r\n' || true)"
        if [[ -n "$resolved_name" && -n "$resolved_version" ]]; then
            resolved_spec="${resolved_name}@${resolved_version}"
            log_info "Pinned package spec: $resolved_spec"

            expected_integrity="$requested_integrity"
            if [[ -z "$expected_integrity" ]]; then
                expected_integrity="$(npm view "$resolved_spec" dist.integrity 2>/dev/null | tr -d '\r\n' || true)"
            fi

            if [[ -z "$expected_integrity" && "$require_integrity" == "1" ]]; then
                log_warn "Missing dist.integrity for $resolved_spec (set NPM_REQUIRE_INTEGRITY=0 to bypass)"
            else
                tmp_dir="$(mktemp -d)"
                if pack_output="$(npm pack "$resolved_spec" --silent --pack-destination "$tmp_dir" 2>&1)"; then
                    tarball_name="$(printf '%s\n' "$pack_output" | tail -n 1 | tr -d '\r')"
                    tarball_path="$tmp_dir/$tarball_name"
                    if [[ -f "$tarball_path" ]]; then
                        actual_integrity="$(sha512_sri_for_file "$tarball_path" 2>/dev/null || true)"
                        if [[ -n "$expected_integrity" && "$actual_integrity" != "$expected_integrity" ]]; then
                            log_warn "Integrity mismatch for $resolved_spec (expected $expected_integrity, got $actual_integrity)"
                        else
                            log_info "Installing $resolved_spec from verified tarball..."
                            if npm install -g --save-exact "$tarball_path" 2>&1; then
                                installed_version="$(
                                    npm list -g --depth=0 "$resolved_name" --json 2>/dev/null \
                                    | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const dep=(data.dependencies||{})[process.argv[1]];process.stdout.write(dep&&dep.version?dep.version:"");' "$resolved_name" 2>/dev/null \
                                    || true
                                )"
                                if [[ "$installed_version" == "$resolved_version" ]]; then
                                    install_ok=1
                                else
                                    log_warn "Installed version mismatch for $resolved_name (expected $resolved_version, got ${installed_version:-none})"
                                fi
                            fi
                        fi
                    else
                        log_warn "Failed to locate packed tarball for $resolved_spec"
                    fi
                else
                    log_warn "Failed to pack $resolved_spec"
                fi
            fi
        else
            log_warn "Failed to resolve package metadata for $requested_spec"
        fi

        if [[ -n "$tmp_dir" ]]; then
            rm -rf "$tmp_dir"
        fi

        if (( install_ok == 1 )); then
            log_info "$resolved_spec installed successfully"
            return 0
        fi

        log_warn "$requested_spec install attempt $attempt failed"
        if (( attempt < max_retries )); then
            log_info "Retrying in ${backoff}s..."
            sleep "$backoff"
            backoff=$((backoff * 2))
        fi
    done

    log_error "Failed to install $requested_spec after $max_retries attempts"
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
