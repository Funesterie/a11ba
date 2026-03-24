#!/usr/bin/env bash
set -euo pipefail

# Include common user-local bin paths where pip installs executables.
export PATH="/root/.local/bin:/app/.local/bin:${PATH}"

echo "[A11] Booting server..."

PIPER_PID=""

if [ "${ENABLE_PIPER_HTTP:-false}" = "true" ]; then
	if [ -n "${PIPER_START_CMD:-}" ]; then
		PIPER_START_CMD="${PIPER_START_CMD}"
	elif command -v piper >/dev/null 2>&1; then
		PIPER_START_CMD="piper --model ${TTS_MODEL_PATH:-/app/apps/server/tts/fr_FR-siwis-medium.onnx} --port ${TTS_PORT:-5002}"
	else
		PIPER_START_CMD="python3 -m piper --model ${TTS_MODEL_PATH:-/app/apps/server/tts/fr_FR-siwis-medium.onnx} --port ${TTS_PORT:-5002}"
	fi
	echo "[A11] Starting Piper with: ${PIPER_START_CMD}"
	bash -lc "${PIPER_START_CMD}" &
	PIPER_PID=$!
	echo "[A11] Piper PID: ${PIPER_PID}"
else
	echo "[A11] ENABLE_PIPER_HTTP=false (Piper HTTP process not started)"
fi

cleanup() {
	if [ -n "${PIPER_PID}" ] && kill -0 "${PIPER_PID}" 2>/dev/null; then
		echo "[A11] Stopping Piper PID ${PIPER_PID}"
		kill "${PIPER_PID}" 2>/dev/null || true
	fi
}

trap cleanup EXIT INT TERM

node server.cjs