#!/bin/bash
# Record every new or changed line, check it, and update the game's voice index.
# Needs Python 3.10+, ffmpeg, and network access to PyPI and GitHub (first run only).
# Models are cached in $VOICE_CACHE (default ~/.cache/wonderwood-voices); they never ship with the game.
set -euo pipefail
cd "$(dirname "$0")/../.."
CACHE="${VOICE_CACHE:-$HOME/.cache/wonderwood-voices}"
mkdir -p "$CACHE"
if [ ! -x "$CACHE/venv/bin/python" ]; then
  python3 -m venv "$CACHE/venv"
  "$CACHE/venv/bin/pip" install -q kokoro-onnx==0.6.1 soundfile sherpa-onnx
fi
fetch() { [ -f "$CACHE/$2" ] || curl -sSfL -o "$CACHE/$2" "$1"; }
fetch https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx kokoro-v1.0.onnx
fetch https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin voices-v1.0.bin
if [ ! -d "$CACHE/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8" ]; then
  curl -sSfL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2 | tar -xj -C "$CACHE"
fi
node tools/voices/extract.mjs jobs "$CACHE/jobs.json"
"$CACHE/venv/bin/python" tools/voices/generate.py "$CACHE/jobs.json" public/voice "$CACHE" tools/voices/results.json
node tools/voices/extract.mjs index tools/voices/results.json
