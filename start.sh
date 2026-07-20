#!/usr/bin/env sh
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

echo "[Hefestos] Starting OpenCode web..."
opencode web --hostname 0.0.0.0 --port 10001 &
OPID=$!

echo "[Hefestos] Waiting for OpenCode..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:10001/global/health > /dev/null 2>&1; then
    echo "[Hefestos] OpenCode ready!"
    break
  fi
  sleep 2
done

echo "[Hefestos] Starting server on port ${PORT:-4096}..."
exec node server.js
