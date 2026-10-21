#!/usr/bin/env bash
# APEX Humanoid — one-command local run
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
npx vite build
NODE_ENV=production PORT="${PORT:-3000}" npx tsx server.ts
