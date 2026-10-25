#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 🐙 GITHUB PUSH — poora project (code + worker + docs) Aidavil112/apex-humanoid-v2 par.
#    usage:  bash tools/push-github.sh <TOKEN>
#    ya:     GH_TOKEN=github_pat_xxx bash tools/push-github.sh
#
#    ⚠️ Token sirf is command ke liye use hota hai — koi file me NAHI likha jaata,
#       remote URL se token turant hata diya jaata hai, aur .gitignore ke liye
#       node_modules/dist/keystore/apk jaise bhaari-chiz commit nahi hoti.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
REPO_DIR="${REPO_DIR:-/home/user/repo}"
TOK="${1:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
OWNER="${GH_OWNER:-Aidavil112}"
NAME="${GH_REPO:-apex-humanoid-v2}"
BR="${GH_BRANCH:-main}"
MSG="${GH_MSG:-v6.6.13 (build 54): voice routing + stuck-lock fixes, jsdom suite, build/upload tools}"

if [ -z "$TOK" ]; then
  cat <<'NO'
❌ Token chahiye. Do tarike:
   A) github.com → Settings → Developer settings → Personal access tokens →
      Fine-grained token → scope: Contents: Read and write → repository: apex-humanoid-v2
   B) phir:  bash tools/push-github.sh github_pat_....   (ya GH_TOKEN=.. bash tools/push-github.sh)
   ⚠️ Kaam ke baad token revoke karna (chat me aaya hua token public ho sakta hai).
NO
  exit 2
fi

cd "$REPO_DIR"
# 1) safety: bhaari/sensitive files tracked na hon
grep -q "^node_modules/" .gitignore 2>/dev/null || printf "node_modules/\ndist/\n*.apk\n*.keystore\ntools/.bundle.mjs\n.harness-entry.tsx\ncloudflare-bot/site/\n.env\n" >> .gitignore
for bad in APEX-AI-Pro.apk playstore-kit; do
  if git ls-files --error-unmatch "$bad" >/dev/null 2>&1; then git rm -r --cached "$bad" >/dev/null; echo "   (untracked: $bad)"; fi
done

# 2) commit (jo bhi naya hai)
git add -A
git -c user.name="APEX Jarvis" -c user.email="jarvis@apex.local" commit -q -m "$MSG" 2>/dev/null || echo "   (kuch naya commit karne ko nahi)"

# 3) push (token sirf is ek request me)
git remote remove origin 2>/dev/null || true
git -c credential.helper= push -q "https://x-access-token:${TOK}@github.com/${OWNER}/${NAME}.git" "HEAD:refs/heads/${BR}" 2>&1 | sed 's/x-access-token:[^@]*@/x-access-token:***@/g' || {
  echo "❌ push fail — repo exist nahi karta to pehle banao:"
  echo "   curl -s -X POST https://api.github.com/user/repos -H \"Authorization: Bearer $TOK\" -H 'Content-Type: application/json' -d '{\"name\":\"$NAME\",\"public\":true}'"
  exit 1
}
git remote remove origin 2>/dev/null || true
HEAD_SHA=$(git rev-parse --short HEAD)
echo "✅ push ho gaya → https://github.com/$OWNER/$NAME/tree/$BR  (tip $HEAD_SHA)"
echo "   raw test: curl -sI https://raw.githubusercontent.com/$OWNER/$NAME/$BR/cloudflare-bot/worker.js | head -1"
echo "🧹 token sirf is command me tha; koi file/.git/config me nahi likha. Ab GitHub par jaake revoke kar do."
