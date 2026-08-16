#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- Settings (edit DATA_DIR if needed) ---
DATA_DIR="./data/production"
OUT="./output/report.html"
CONFIG="./config/scoring.json"
EXTRA=()

if [[ "${1:-}" == "--dry-run" ]]; then
  EXTRA=(--dry-run)
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found. Install from https://nodejs.org/" >&2
  exit 1
fi

if [[ ! -f "dist/cli.js" ]]; then
  echo "[ERROR] dist/cli.js missing. Run: npm run build" >&2
  exit 1
fi

if [[ ! -d "$DATA_DIR" ]]; then
  echo "[ERROR] Data folder missing: $DATA_DIR" >&2
  echo "        Copy CSV files from data/sample or add your production CSVs." >&2
  exit 1
fi

echo
echo "Creating development proposal report..."
echo "  Data: $DATA_DIR"
echo "  Out:  $OUT"
if ((${#EXTRA[@]})); then
  echo "  Mode: dry-run"
fi
echo

rm -f "$OUT"

NODE_ARGS=(dist/cli.js --data "$DATA_DIR" --out "$OUT" --config "$CONFIG" "${EXTRA[@]}")
if [[ -f ".env" ]]; then
  node --env-file=.env "${NODE_ARGS[@]}"
else
  if ((${#EXTRA[@]} == 0)); then
    echo "[WARN] .env not found. Set GOOGLE_API_KEY for LLM mode."
    echo "       Free trial: ./scripts/report.sh --dry-run"
    echo
  fi
  node "${NODE_ARGS[@]}"
fi

echo
echo "Done: $OUT"
if [[ -f "$OUT" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$OUT"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$OUT"
  fi
fi
