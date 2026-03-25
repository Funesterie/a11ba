#!/usr/bin/env bash
set -eu
# Enable pipefail when supported (bash), ignore otherwise.
set -o pipefail 2>/dev/null || true

# Include common user-local bin paths where pip installs executables.
export PATH="/opt/venv/bin:/root/.local/bin:/app/.local/bin:${PATH}"

# Nix environments may not expose libstdc++ to Python wheels by default.
# Find libstdc++.so.6 and expose it through LD_LIBRARY_PATH for numpy/piper.
if [ -z "${LD_LIBRARY_PATH:-}" ]; then
	export LD_LIBRARY_PATH=""
fi
LIBSTDCPP_PATH="$(find /nix/store -type f -name 'libstdc++.so.6' 2>/dev/null | head -n 1 || true)"
if [ -n "${LIBSTDCPP_PATH}" ]; then
	LIBSTDCPP_DIR="$(dirname "${LIBSTDCPP_PATH}")"
	case ":${LD_LIBRARY_PATH}:" in
		*":${LIBSTDCPP_DIR}:"*) ;;
		*) export LD_LIBRARY_PATH="${LIBSTDCPP_DIR}:${LD_LIBRARY_PATH}" ;;
	esac
	echo "[A11] libstdc++ detected at ${LIBSTDCPP_DIR}"
else
	echo "[A11] WARNING: libstdc++.so.6 not found in /nix/store"
fi

echo "[A11] Booting server..."

PIPER_PID=""

if [ "${ENABLE_PIPER_HTTP:-false}" = "true" ]; then
	export TTS_OUT_DIR="${TTS_OUT_DIR:-/app/public/tts}"
	export PIPER_HTTP_PORT="${TTS_PORT:-5002}"
	mkdir -p "${TTS_OUT_DIR}"
	echo "[A11] Starting Piper HTTP server (serve.py) on port ${PIPER_HTTP_PORT}"
	echo "[A11]   Model  : ${TTS_MODEL_PATH:-/app/apps/server/tts/fr_FR-siwis-medium.onnx}"
	echo "[A11]   OutDir : ${TTS_OUT_DIR}"
	python3 /app/apps/tts/serve.py &
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