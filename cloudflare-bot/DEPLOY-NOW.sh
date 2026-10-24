#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ☁️ APEX — Worker DEPLOY (1 command, safe)
#
# Kyun zaroori hai: aapka worker LIVE hai lekin usme naye routes NAHI hain.
# Proof (aaj napa):
#   GET https://apex-humanoid-v2.pradhanbibek53.workers.dev/health
#     → {"ok":true,"telegram":true,"gemini":true,"elevenlabs":true,"coindcx":true,"youtubeUploadAuth":false,...}
#   GET .../jarvis/config   → "APEX Humanoid Hub — open /"   ← matlab route HI nahi (JSON nahi aaya)
#   GET .../jarvis/brain    → "APEX Humanoid Hub — open /"   ← same
# Is script ke baad teeno JSON denge.
#
# Usage:
#   ./DEPLOY-NOW.sh              # build + site copy + login check + deploy
#   ./DEPLOY-NOW.sh --no-build   # jo dist already hai wahi use karo
#   ./DEPLOY-NOW.sh --kv         # pehle APEX_KV namespace banao + id khud bhar do
# ---------------------------------------------------------------------------
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DO_BUILD=1
MAKE_KV=0
for a in "$@"; do
  case "$a" in
    --no-build) DO_BUILD=0 ;;
    --kv) MAKE_KV=1 ;;
  esac
done

echo "① Build (vite)…"
if [ "$DO_BUILD" = "1" ]; then
  cd "$ROOT"
  [ -d node_modules ] || npm install --no-audit --no-fund
  npm run build
fi

echo "② Static assets (jo worker / par app serve karta hai) copy…"
mkdir -p "$HERE/site"
if [ -d "$ROOT/dist" ]; then
  rm -rf "$HERE/site"/* && cp -rf "$ROOT/dist/." "$HERE/site/"
  echo "   dist → cloudflare-bot/site OK ($(find "$HERE/site" -type f | wc -l) files)"
else
  echo "   ⚠️ $ROOT/dist nahi mila — [assets] block hata kar deploy hoga toh / par app 404 ho sakta hai!"
fi

echo "③ Wrangler login check…"
cd "$HERE"
if ! npx --yes wrangler whoami 2>/dev/null | grep -qi "_logged in\|Authenticated\|email"; then
  npx --yes wrangler login
fi

if [ "$MAKE_KV" = "1" ]; then
  echo "④ KV namespace APEX_KV banao…"
  OUT=$(npx --yes wrangler kv namespace create APEX_KV || true)
  echo "$OUT"
  ID=$(printf '%s' "$OUT" | grep -oE 'id = "[A-Za-z0-9]+"' | head -n1 | cut -d'"' -f2 || true)
  if [ -n "${ID:-}" ]; then
    sed -i.bak "s|^# *id = \"PAST_YOUR_NAMESPACE_ID_HERE\"|id = \"$ID\"|" "$HERE/wrangler.toml"
    echo "   ✅ id wrangler.toml me bhar di gayi: $ID"
  else
    echo "   ⚠️ id auto-parse nahi hui — wrangler.toml me khud bhar do (id = \"…\")"
  fi
fi

echo "⑤ Deploy (project: apex-humanoid-v2 — purane worker par hi overwrite hoga)…"
npx --yes wrangler deploy

echo
echo "⑥ Verify (ye 3 URLs kholo — JSON aana chahiye, \"APEX Humanoid Hub — open /\" nahi):"
echo "   https://apex-humanoid-v2.pradhanbibek53.workers.dev/health"
echo "   https://apex-humanoid-v2.pradhanbibek53.workers.dev/jarvis/config"
echo "   https://apex-humanoid-v2.pradhanbibek53.workers.dev/jarvis/brain"
echo
echo "⑦ Baaki (ek-baar ka kaam):"
echo "   npx wrangler secret put YOUTUBE_REFRESH_TOKEN     # abhi health me youtubeUploadAuth:false hai
   → browser: https://apex-humanoid-v2.pradhanbibek53.workers.dev/yt/auth?scope=full
   npx wrangler secret put APEX_BRAIN_KEY                # optional brain lock
   App me: 🛰️ Jarvis Core → 📸 INSTAGRAM card → '🧪 GITHUB ACCESS CHECK' (asli GitHub username ke saath)"
