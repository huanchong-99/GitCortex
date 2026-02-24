#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

trap 'log_error "Installation failed at line $LINENO"' ERR

require_command node
require_command npm

log_info "=== GitCortex AI CLI Installation ==="

CORE_CLIS=(
    "${CLAUDE_CODE_NPM_PKG:-@anthropic-ai/claude-code}"
    "${CODEX_NPM_PKG:-@openai/codex}"
    "${GEMINI_NPM_PKG:-@google/gemini-cli}"
)

EXTENDED_CLIS=(
    "${QWEN_NPM_PKG:-@qwen-code/qwen-code@latest}"
    "${AMP_NPM_PKG:-@sourcegraph/amp@latest}"
    "${OPENCODE_NPM_PKG:-opencode-ai@latest}"
    "${KILOCODE_NPM_PKG:-@kilocode/cli}"
)

FAILED=0

log_info "--- Installing core CLIs ---"
for pkg in "${CORE_CLIS[@]}"; do
    npm_install_global "$pkg" 3 || FAILED=$((FAILED + 1))
done

log_info "--- Installing extended CLIs (best-effort) ---"
for pkg in "${EXTENDED_CLIS[@]}"; do
    npm_install_global "$pkg" 2 || log_warn "Skipping optional: $pkg"
done

if command -v gh >/dev/null 2>&1; then
    : "${GH_EXTENSIONS_DIR:=/opt/gitcortex/gh-extensions}"
    export GH_EXTENSIONS_DIR
    mkdir -p "$GH_EXTENSIONS_DIR"

    if gh extension list 2>/dev/null | awk '{print $1}' | grep -Fxq "github/gh-copilot"; then
        log_info "GitHub Copilot extension already installed"
    else
        log_info "Installing GitHub Copilot CLI extension..."
        gh extension install github/gh-copilot 2>&1 || log_warn "Skipping gh-copilot"
    fi
else
    log_warn "gh CLI not found, skipping gh-copilot"
fi

log_info "=== Installation complete (core failures: $FAILED) ==="
bash "$SCRIPT_DIR/verify-all-clis.sh" || FAILED=$((FAILED + 1))
exit $FAILED
