#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_WASM="${SCRIPT_DIR}/../node_modules/@wterm/ghostty/wasm/ghostty-vt.wasm"
TARGET_DIR="${SCRIPT_DIR}/../public"
TARGET_WASM="${TARGET_DIR}/ghostty.wasm"

if [ ! -f "${SOURCE_WASM}" ]; then
  echo "[scripts] ERROR: ghostty wasm not found at ${SOURCE_WASM}" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"
cp "${SOURCE_WASM}" "${TARGET_WASM}"
echo "[scripts] Copied ghostty.wasm to public/"
