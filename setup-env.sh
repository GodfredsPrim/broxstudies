#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

copy_if_missing() {
  local example="$1"
  local target="$2"
  if [[ -f "$target" ]]; then
    echo "exists: $target"
  else
    cp "$example" "$target"
    echo "created: $target"
  fi
}

copy_if_missing "$ROOT/backend/.env.example" "$ROOT/backend/.env"
copy_if_missing "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"

echo ""
echo "Done. Edit backend/.env and add your API keys before using AI features."
