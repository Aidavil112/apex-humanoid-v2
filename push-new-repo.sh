#!/usr/bin/env bash
# ------------------------------------------------------------------
# APEX Humanoid — naya GitHub repo banao aur pura code push karo
#
# Usage:
#   GITHUB_TOKEN=github_pat_xxx ./push-new-repo.sh <repo-name> [private|public]
#
# Example:
#   GITHUB_TOKEN=github_pat_xxx ./push-new-repo.sh apex-humanoid private
# ------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

REPO_NAME="${1:-apex-humanoid}"
VISIBILITY="${2:-private}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN set karo: GITHUB_TOKEN=... ./push-new-repo.sh apex-humanoid private}"

API="https://api.github.com"
AUTH=(-H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

echo "→ Token verify kar raha hoon..."
USER_JSON=$(curl -sS -f "${AUTH[@]}" "$API/user")
OWNER=$(printf '%s' "$USER_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["login"])')
echo "  ✔ Logged in as: $OWNER"

echo "→ Repo create kar raha hoon: $OWNER/$REPO_NAME ($VISIBILITY)"
CODE=$(curl -sS -o /tmp/repo_create.json -w '%{http_code}' -X POST "${AUTH[@]}" \
  "$API/user/repos" \
  -d "{\"name\":\"${REPO_NAME}\",\"private\":$([ "$VISIBILITY" = "private" ] && echo true || echo false),\"description\":\"APEX Humanoid — procedural WebGL2 particle humanoid with voice agent, mood engine and creative tools\",\"auto_init\":false}")

if [ "$CODE" = "201" ]; then
  echo "  ✔ Repo ban gaya"
elif [ "$CODE" = "422" ]; then
  echo "  ℹ Repo pehle se exist karta hai — usi mein push karunga"
else
  echo "  ✘ Repo create fail (HTTP $CODE):"; cat /tmp/repo_create.json; exit 1
fi

REMOTE_URL="https://${OWNER}:${GITHUB_TOKEN}@github.com/${OWNER}/${REPO_NAME}.git"
git remote remove neworigin 2>/dev/null || true
git remote add neworigin "$REMOTE_URL"

echo "→ Push kar raha hoon (main branch)..."
git push -u neworigin HEAD:refs/heads/main --force

git remote set-url neworigin "https://github.com/${OWNER}/${REPO_NAME}.git"

echo
echo "✅ Ho gaya: https://github.com/${OWNER}/${REPO_NAME}"
echo "   ⚠️  Kaam khatam — ab token GitHub se REVOKE kar dena:"
echo "      https://github.com/settings/tokens"
