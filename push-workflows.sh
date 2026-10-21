#!/usr/bin/env bash
# ------------------------------------------------------------------
# GitHub Actions workflows ko repo mein daalta hai.
#
# Kyun alag? .github/workflows/*.yml push karne ke liye token mein
# `Workflows: Read and write` permission chahiye hoti hai.
#
# Usage:  GITHUB_TOKEN=github_pat_xxx ./push-workflows.sh
# ------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

: "${GITHUB_TOKEN:?GITHUB_TOKEN set karo: GITHUB_TOKEN=... ./push-workflows.sh}"

[ -d .github/workflows ] || { echo "✘ .github/workflows nahi mila is folder mein"; exit 1; }

git add .github
if ! git diff --cached --quiet; then
  git -c user.email=agent@arena.ai -c user.name="Arena Agent" \
      commit -q -m "ci: GitHub Actions — typecheck, build, smoke test, Docker, Render auto-deploy"
  echo "✔ workflow commit bana"
else
  echo "ℹ workflow already committed"
fi

REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/Aidavil112/apex-humanoid-v2.git"
if git -c credential.helper= push "$REMOTE" HEAD:refs/heads/main 2>/tmp/pushwf.err; then
  echo "✅ Push ho gaya — https://github.com/Aidavil112/apex-humanoid-v2/actions"
else
  sed "s|${GITHUB_TOKEN}|***|g" /tmp/pushwf.err
  cat <<'MSG'

✘ Token mein `Workflows` permission nahi hai.

Fix (30 sec):
  1. https://github.com/settings/personal-access-tokens → token → Edit
  2. Repository permissions → "Workflows" → Read and write → Save
  3. Dobara: GITHUB_TOKEN=... ./push-workflows.sh

— YA — web UI (token ki zaroorat nahi):
  1. repo → Actions tab → "set up a workflow yourself"
  2. .github/workflows/ci.yml ka content paste → Commit
  3. deploy-render.yml ke liye dohrao
MSG
  exit 1
fi
