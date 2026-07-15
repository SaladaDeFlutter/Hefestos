#!/bin/sh
echo "Starting OpenCode server..."
opencode serve --hostname 0.0.0.0 --port 10001 &
OPENCODE_PID=$!

echo "Waiting for OpenCode to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:10001/global/health > /dev/null 2>&1; then
    echo "OpenCode is ready!"
    break
  fi
  echo "Attempt $i/30 - waiting..."
  sleep 2
done

echo "Starting proxy..."
exec node /app/proxy.js
