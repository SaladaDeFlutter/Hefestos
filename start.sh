#!/usr/bin/env sh
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

echo "[Hefestos] Starting OpenCode..."
opencode web --hostname 0.0.0.0 --port 10001 &

echo "[Hefestos] Waiting for OpenCode..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:10001/global/health > /dev/null 2>&1; then
    echo "[Hefestos] OpenCode ready"
    break
  fi
  sleep 2
done

PORT="${PORT:-4096}"
echo "[Hefestos] Server listening on http://localhost:${PORT}"
echo "[Hefestos] Admin panel: http://localhost:${PORT}/admin"
exec node server.js
