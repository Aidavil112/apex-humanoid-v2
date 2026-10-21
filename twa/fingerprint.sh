#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SHA-256 fingerprints nikaalo aur assetlinks.json verify karo.
#
#   ./fingerprint.sh                 # local keystore (password prompt)
#   ./fingerprint.sh <storepass>     # local keystore, non-interactive
#   DOMAIN=apex.example.com ./fingerprint.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

KS="${KEYSTORE:-android.keystore}"
ALIAS="${ALIAS:-android}"
DOMAIN="${DOMAIN:-}"

if [ -f "$KS" ]; then
  echo "=== Local upload key ($KS) ==="
  if [ $# -ge 1 ]; then
    keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$1" 2>/dev/null \
      | grep -i "SHA256:" | sed 's/.*SHA256: //' | sed 's/^/  /'
  else
    keytool -list -v -keystore "$KS" -alias "$ALIAS" 2>/dev/null \
      | grep -i "SHA256:" | sed 's/.*SHA256: //' | sed 's/^/  /'
  fi
  echo
fi

cat <<'MSG'
=== Play App Signing key (Play Console) ===
Play Console → App → Test and release → Setup → App integrity → App signing key certificate
→ "SHA-256 certificate fingerprint" copy karo.

Dono fingerprints (upload + Play signing) comma se alag karke env var mein daalo:
  ANDROID_SHA256_FINGERPRINTS=AA:BB:...,CC:DD:...
  ANDROID_PACKAGE_NAME=com.aidavil.apexhumanoid

MSG

if [ -n "$DOMAIN" ]; then
  echo "=== Asset links live check ($DOMAIN) ==="
  URL="https://${DOMAIN}/.well-known/assetlinks.json"
  if curl -sf "$URL" | python3 -m json.tool; then
    echo "  ✔ assetlinks.json serve ho raha hai"
  else
    echo "  ✘ $URL 404/error — env vars set karke redeploy karo"
  fi
  echo
  echo "Google verifier:"
  echo "  https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://${DOMAIN}&relation=delegate_permission/common.handle_all_urls"
fi
