#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 🧪 UI TEST SUITE — typecheck + jsdom me App mount + har button click.
#    Har build se PEHLE chalana hai (tsc akela kaafi nahi: code compile ho sakta
#    hai par UI me feature render hi na ho — v6.6.11 ka ALL VIDEOS (0) wala sabak).
#    Use: bash tools/ui-test.sh   (exit 0 = ship ke liye taiyar)
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
[ -x node_modules/.bin/tsc ] || npm install --no-audit --no-fund >/dev/null 2>&1
if [ ! -d node_modules/jsdom ]; then
  echo "• jsdom install ho raha hai (dev-only)…"
  npm i --no-audit --no-fund --silent jsdom >/dev/null 2>&1
fi
echo "── 1/3 tsc --noEmit ──"
./node_modules/.bin/tsc --noEmit || { echo "❌ typecheck fail"; exit 1; }
echo "── 2/3 core-panel test ──"
node tools/core-panel-test.mjs; A=$?
echo "── 3/3 click sweep ──"
node tools/click-sweep.mjs; B=$?
echo
if [ $A -eq 0 ] && [ $B -eq 0 ]; then echo "🧪 UI SUITE: ✅ sab pass — build aage ja sakta hai"; exit 0; fi
echo "🧪 UI SUITE: ❌ fail (core=$A sweep=$B) — pehle theek karo, phir package karo"; exit 1
