#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Play Store ready Android App Bundle (.aab) banane ke liye.
#
#   DOMAIN=apex-humanoid-xxxx.onrender.com ./twa/build.sh
#   DOMAIN=apex.example.com PACKAGE=com.aidavil.apexhumanoid ./twa/build.sh
#
# Zaroorat: JDK 17 (bubblewrap khud download kar sakta hai), ~4 GB disk.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${DOMAIN:?DOMAIN set karo — e.g. DOMAIN=apex-humanoid-xxxx.onrender.com ./twa/build.sh}"
PACKAGE="${PACKAGE:-com.aidavil.apexhumanoid}"
BASE="https://${DOMAIN}"

echo "→ Domain : ${BASE}"
echo "→ Package: ${PACKAGE}"

# ---- 0. Sanity: site live hai aur PWA manifest serve ho raha hai? ----
echo "→ Site check..."
curl -sfI "${BASE}/" >/dev/null || { echo "✘ ${BASE} khul nahi raha — pehle deploy karo"; exit 1; }
curl -sf "${BASE}/manifest.webmanifest" >/dev/null \
  || { echo "✘ ${BASE}/manifest.webmanifest missing — PWA manifest deploy hua?"; exit 1; }
echo "  ✔ site + manifest reachable"

# ---- 1. twa-manifest.json generate (domain/package substitute) ----
echo "→ twa-manifest.json bana raha hoon..."
python3 - "$DOMAIN" "$PACKAGE" <<'PY'
import json, sys, pathlib
domain, package = sys.argv[1], sys.argv[2]
base = f"https://{domain}"
p = pathlib.Path("twa-manifest.json")
m = json.loads(p.read_text()) if p.exists() else {}
m.update({
    "packageId": package,
    "host": domain,
    "iconUrl": f"{base}/icon-512.png",
    "maskableIconUrl": f"{base}/icon-512.png",
    "monochromeIconUrl": f"{base}/icon-512.png",
    "webManifestUrl": f"{base}/manifest.webmanifest",
    "fullScopeUrl": f"{base}/",
})
p.write_text(json.dumps(m, indent=2) + "\n")
print("  ✔ twa-manifest.json ready")
PY

# ---- 2. Keystore (na ho to banao) ----
if [ ! -f android.keystore ]; then
  echo "→ Signing keystore bana raha hoon (android.keystore)..."
  if [ -z "${KEYSTORE_PASS:-}" ]; then
    echo "  ⚠ KEYSTORE_PASS set nahi hai — ek random password generate kar raha hoon."
    KEYSTORE_PASS="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 20)"
    echo "  🔑 KEYSTORE_PASS=${KEYSTORE_PASS}"
    echo "     ⬆️  ISE KAHIN SAFE LIKH LO. Kho gaya to Play Store pe app update nahi kar paoge."
  fi
  keytool -genkeypair -v \
    -keystore android.keystore -alias android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" \
    -dname "CN=APEX Humanoid, OU=Mobile, O=Aidavil, L=Bengaluru, ST=Karnataka, C=IN" >/dev/null
  echo "  ✔ keystore ban gaya (gitignored)"
  echo
  echo "→ Ab ye env var host pe set karo (Play ke bina test karne ke liye):"
  ./fingerprint.sh "$KEYSTORE_PASS"
  echo
else
  echo "→ Existing keystore mil gaya: android.keystore"
fi

# ---- 3. Bubblewrap: build ----
echo "→ Bubblewrap install/build (first run pe JDK+SDK download kar sakta hai)..."
npx --yes @bubblewrap/cli@latest build --skipPwaValidation

echo
echo "✅ Done. Files:"
ls -1 *.aab *.apk 2>/dev/null | sed 's/^/   /'
echo
echo "Ab Play Console pe *.aab upload karo — steps: PLAYSTORE.md"
echo "Upload ke baad Play App Signing fingerprint ke liye: ./fingerprint.sh"
