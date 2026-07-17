#!/bin/sh
if [ -n "$DEEPSEEK_API_KEY" ]; then
  mkdir -p "$HOME/.local/share/opencode"
  printf '{"deepseek":{"type":"api","key":"%s"}}\n' "$DEEPSEEK_API_KEY" > "$HOME/.local/share/opencode/auth.json"
fi

exec opencode web --hostname 0.0.0.0 --port "${PORT:-10000}"
