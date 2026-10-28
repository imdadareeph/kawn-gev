#!/usr/bin/env bash
# Stops anything listening on the usual Kawn dev ports, then starts this project fresh.
set -e
cd "$(dirname "$0")"
for port in 5173 5174 5175 5176 8787 8788 8789; do
  pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping process on port $port: $pids"
    kill $pids 2>/dev/null || true
  fi
done
sleep 1
npm install
exec npm run dev
