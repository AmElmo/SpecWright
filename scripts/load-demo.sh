#!/usr/bin/env bash
#
# load-demo.sh — Load demo fixtures into SpecWright outputs/
#
# Usage:
#   ./scripts/load-demo.sh          # Load fixtures (backs up existing outputs/ first)
#   ./scripts/load-demo.sh --clean  # Remove existing outputs/ before loading (no backup)
#   ./scripts/load-demo.sh --reset  # Restore the backup created by a previous load
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$ROOT_DIR/fixtures/demo/outputs"
OUTPUTS_DIR="$ROOT_DIR/outputs"
BACKUP_DIR="$ROOT_DIR/outputs.bak"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
err()   { echo -e "${RED}✗${NC}  $*" >&2; }

# ─── Reset mode: restore backup ──────────────────────────────────────────────
if [[ "${1:-}" == "--reset" ]]; then
  if [[ ! -d "$BACKUP_DIR" ]]; then
    err "No backup found at outputs.bak/. Nothing to restore."
    exit 1
  fi
  rm -rf "$OUTPUTS_DIR"
  mv "$BACKUP_DIR" "$OUTPUTS_DIR"
  ok "Restored outputs/ from backup."
  exit 0
fi

# ─── Verify fixtures exist ───────────────────────────────────────────────────
if [[ ! -d "$FIXTURES_DIR/projects" ]]; then
  err "Fixtures not found at fixtures/demo/outputs/projects/"
  err "Make sure you're running this from the specwright repo root."
  exit 1
fi

# ─── Handle existing outputs/ ────────────────────────────────────────────────
if [[ -d "$OUTPUTS_DIR/projects" ]]; then
  if [[ "${1:-}" == "--clean" ]]; then
    warn "Removing existing outputs/ (--clean mode)"
    rm -rf "$OUTPUTS_DIR"
  else
    if [[ -d "$BACKUP_DIR" ]]; then
      warn "Previous backup exists at outputs.bak/ — overwriting it."
      rm -rf "$BACKUP_DIR"
    fi
    info "Backing up existing outputs/ → outputs.bak/"
    cp -a "$OUTPUTS_DIR" "$BACKUP_DIR"
    rm -rf "$OUTPUTS_DIR/projects"
  fi
fi

# ─── Copy fixtures ───────────────────────────────────────────────────────────
mkdir -p "$OUTPUTS_DIR"
cp -a "$FIXTURES_DIR/projects" "$OUTPUTS_DIR/projects"

# ─── Freshen timestamps ─────────────────────────────────────────────────────
# Update createdAt/lastUpdatedAt in project_status.json to be relative to now
# so the projects feel "recent" in the UI.
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

update_timestamps() {
  local status_file="$1"
  if command -v python3 &>/dev/null; then
    python3 -c "
import json, sys
from datetime import datetime, timedelta, timezone

with open('$status_file', 'r') as f:
    data = json.load(f)

now = datetime.now(timezone.utc)

# Parse original created/updated to figure out offset
orig_created = datetime.fromisoformat(data['createdAt'].replace('Z', '+00:00'))
orig_updated = datetime.fromisoformat(data['lastUpdatedAt'].replace('Z', '+00:00'))
duration = orig_updated - orig_created

# Set new times: created = now - duration, updated = now
new_created = now - duration
data['createdAt'] = new_created.strftime('%Y-%m-%dT%H:%M:%S.000Z')
data['lastUpdatedAt'] = now.strftime('%Y-%m-%dT%H:%M:%S.000Z')

with open('$status_file', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
  fi
}

for status_file in "$OUTPUTS_DIR"/projects/*/project_status.json; do
  if [[ -f "$status_file" ]]; then
    update_timestamps "$status_file"
  fi
done

# ─── Summary ─────────────────────────────────────────────────────────────────
PROJECT_COUNT=$(ls -d "$OUTPUTS_DIR/projects"/*/ 2>/dev/null | wc -l | tr -d ' ')

echo ""
ok "Loaded ${PROJECT_COUNT} demo projects into outputs/projects/"
echo ""

for dir in "$OUTPUTS_DIR"/projects/*/; do
  project_name=$(basename "$dir")
  echo "   ${BLUE}•${NC} $project_name"
done

echo ""
info "Start the server:  npm run dev:server"
info "Start the UI:      npm run dev:ui"
info "Restore original:  ./scripts/load-demo.sh --reset"
echo ""
