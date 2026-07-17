#!/bin/sh
if [ -n "$DEEPSEEK_API_KEY" ]; then
  mkdir -p "$HOME/.local/share/opencode"
  printf '{"deepseek":{"type":"api","key":"%s"}}\n' "$DEEPSEEK_API_KEY" > "$HOME/.local/share/opencode/auth.json"
fi

echo "Starting OpenCode web..."
opencode web --hostname 0.0.0.0 --port 10001 &
OPID=$!

echo "Waiting for OpenCode..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:10001/global/health > /dev/null 2>&1; then
    echo "OpenCode ready!"
    break
  fi
  sleep 2
done

echo "Starting proxy..."
exec node /app/proxy.js
