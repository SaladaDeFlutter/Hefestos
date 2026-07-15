#!/usr/bin/env sh
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec opencode web --hostname 0.0.0.0 --port "${PORT:-4096}"
