#!/usr/bin/env bash
set -euo pipefail

# scripts/migrate_auto_confirm.sh
# Phase 25 / Task 25.3
#
# Usage:
#   ./scripts/migrate_auto_confirm.sh --dry-run [--db <path>]
#   ./scripts/migrate_auto_confirm.sh --apply   [--db <path>] [--yes]
#   ./scripts/migrate_auto_confirm.sh <db_path>                # dry-run
#
# Examples:
#   ./scripts/migrate_auto_confirm.sh --dry-run --db ./gitcortex.db
#   ./scripts/migrate_auto_confirm.sh --apply --db ./gitcortex.db
#   ./scripts/migrate_auto_confirm.sh ./gitcortex.db

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/migrate_auto_confirm.sql"

MODE="dry-run"
AUTO_YES=0
DB_PATH="./gitcortex.db"
POSITIONAL_DB=""

usage() {
  cat <<EOF
Usage:
  $0 --dry-run [--db <path>]
  $0 --apply [--db <path>] [--yes]
  $0 <db_path>

Options:
  --dry-run      Preview rows where auto_confirm=0 (default mode)
  --apply        Apply migration (set auto_confirm=1)
  --db <path>    SQLite database file path (default: ./gitcortex.db)
  --yes, -y      Skip interactive confirmation in --apply mode
  --help, -h     Show this help

Examples:
  $0 --dry-run --db ./gitcortex.db
  $0 --apply --db ./gitcortex.db --yes
  $0 ./gitcortex.db
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    --db)
      [[ $# -lt 2 ]] && { echo "❌ Missing value for --db"; exit 1; }
      DB_PATH="$2"
      shift 2
      ;;
    --yes|-y)
      AUTO_YES=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    -*)
      echo "❌ Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      if [[ -n "$POSITIONAL_DB" ]]; then
        echo "❌ Multiple positional DB paths provided: '$POSITIONAL_DB' and '$1'"
        usage
        exit 1
      fi
      POSITIONAL_DB="$1"
      shift
      ;;
  esac
done

if [[ -n "$POSITIONAL_DB" ]]; then
  DB_PATH="$POSITIONAL_DB"
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ sqlite3 command not found. Please install sqlite3 first."
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "❌ SQL file not found: $SQL_FILE"
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "❌ Database file not found: $DB_PATH"
  exit 1
fi

extract_sql_section() {
  local section="$1"
  awk -v section="$section" '
    $0 == "-- " section "-BEGIN" { in_section=1; next }
    $0 == "-- " section "-END"   { in_section=0; next }
    in_section { print }
  ' "$SQL_FILE"
}

run_sql_section() {
  local section="$1"
  extract_sql_section "$section" | sqlite3 -header -column "$DB_PATH"
}

count_pending() {
  sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM terminal WHERE auto_confirm = 0;"
}

echo "📦 Database: $DB_PATH"
echo "🔍 Mode: $MODE"
echo

echo "=== Dry Run: terminals with auto_confirm=0 ==="
run_sql_section "DRY-RUN"
echo

if [[ "$MODE" == "dry-run" ]]; then
  echo "✅ Dry run completed. No changes were made."
  exit 0
fi

PENDING_BEFORE="$(count_pending)"
if [[ "${PENDING_BEFORE:-0}" -eq 0 ]]; then
  echo "✅ No rows need migration (auto_confirm=0 count is 0)."
  exit 0
fi

if [[ "$AUTO_YES" -ne 1 ]]; then
  read -r -p "Apply migration now? This will update ${PENDING_BEFORE} row(s). Type 'yes' to continue: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "❌ Migration cancelled."
    exit 1
  fi
fi

UPDATED_ROWS="$(extract_sql_section "APPLY" | sqlite3 "$DB_PATH" | awk 'NF { last=$0 } END { print last+0 }')"
PENDING_AFTER="$(count_pending)"

echo
echo "=== Apply Result ==="
echo "Updated rows (reported by SQLite): ${UPDATED_ROWS:-0}"
echo "Remaining rows with auto_confirm=0: ${PENDING_AFTER:-0}"

if [[ "${PENDING_AFTER:-0}" -ne 0 ]]; then
  echo "❌ Migration incomplete: some rows still have auto_confirm=0"
  exit 1
fi

echo "✅ Migration applied successfully."
