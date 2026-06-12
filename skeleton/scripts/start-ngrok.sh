#!/usr/bin/env bash
set -euo pipefail
if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not found. Install it from https://ngrok.com"
  exit 1
fi
PORT=${1:-4000}
echo "Starting ngrok for port $PORT..."
ngrok http $PORT
