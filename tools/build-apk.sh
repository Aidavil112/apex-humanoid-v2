#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 📦 APEX APK BUILD — ek version/code do, APK ban kar gate pass karke deta hai.
#
#   usage:  bash tools/build-apk.sh 6.6.12 53
#
# Kya hota hai (asli tareeqa, har build me yahi chala hai):
#   0) 8 Motion-Forge clips + mediapipe (assets/www ke andar rehne wale bhaari files)
#      /var/tmp/apex_media me stage hote hain; wahan na ho to AAPKE PICHLE APK se
#      nikaal liye jaate hain — isliye workspace me 100 MB duplicate nahi padta.
#   1) npm run build (vite) → dist/
#   2) android-native/src/*.java → javac --release 11 → d8 → classes.dex
#   3) res/ + Manifest_pro6.xml → aapt2 compile/link  (0 % compression)
#   4) assets/www (dist + media) + classes.dex → zip -0 (STORED, kuñchit NAHI)
#   5) zipalign -p 4 → apksigner v1+v2+v3 (playstore-kit/apex-v3.keystore)
#   6) tools/verify-apk.sh gate — fail ho to exit 1 (APK tabhi ship hota hai jab gate 0 ho)
#
# ⚠️ Rules jo kabhi nahi todne: package com.apexhumanoid.pro6, authority
#    …pro6.videoprovider, cert apex-v3, assets Stored 0%, aur motion_videos APK ke ANDAR.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
VER="${1:?version chahiye, e.g. 6.6.12}"
CODE="${2:?versionCode chahiye, e.g. 53}"

REPO="/home/user/repo"
NAT="/home/user/android-native"
OUT="/home/user/APEX-AI-Pro.apk"
MEDIA="/var/tmp/apex_media"
BT=/var/tmp/android-sdk/build-tools/34.0.0
AJ=/var/tmp/android-sdk/platforms/android-34/android.jar
KS=/home/user/playstore-kit/apex-v3.keystore
KSP="$(cat /home/user/playstore-kit/keystore-pass.txt | tr -d '\n\r')"
export PATH="$BT:/var/tmp/jdk17/bin:$PATH"
W="/var/tmp/b$CODE"
if [ ! -x "$BT/aapt2" ] || [ ! -x /var/tmp/jdk17/bin/javac ]; then
  echo "• toolchain nahi mila → setup-toolchain.sh chala raha hoon (2 min)…"
  bash "$REPO/tools/setup-toolchain.sh" || { echo "❌ toolchain install fail — SDK/JDK dobara zaroori"; exit 1; }
fi

echo "── 0/6 media stage (clips + mediapipe) ──"
need_clip="$MEDIA/www/motion_videos/clip_7.webm"
if [ ! -f "$need_clip" ]; then
  echo "   • $MEDIA nahi hai → pichle APK se nikaal raha hoon…"
  SRC=""
  for cand in "$OUT" /var/tmp/preview_bundle/APEX-AI-Pro.apk; do
    [ -f "$cand" ] && { SRC="$cand"; break; }
  done
  [ -n "$SRC" ] || { echo "❌ Clips ka koi source nahi (APK bhi nahi bacha) — motion_videos kho gaya, build rok diya."; exit 1; }
  rm -rf /var/tmp/apex_extract; mkdir -p /var/tmp/apex_extract
  ( cd /var/tmp/apex_extract && unzip -q -o "$SRC" 'assets/www/motion_videos/*' 'assets/www/mediapipe/*' )
  mkdir -p "$MEDIA/www"
  cp -a /var/tmp/apex_extract/assets/www/. "$MEDIA/www/"
fi
CLIPS=$(find "$MEDIA/www/motion_videos" -name 'clip_*.webm' 2>/dev/null | wc -l)
CLIPSIZE=$(du -sm "$MEDIA/www/motion_videos" 2>/dev/null | cut -f1)
echo "   clips=$CLIPS size=${CLIPSIZE}MB"
[ "$CLIPS" -ge 8 ] || { echo "❌ 8 clips nahi mile ($CLIPS) — ALL VIDEOS (0) wala regression dobara na aaye, build rok diya."; exit 1; }

echo "── 1/6 web build ──"
cd "$REPO"
[ -d node_modules ] || npm install --no-audit --no-fund
./node_modules/.bin/tsc --noEmit
if [ -d node_modules/jsdom ]; then node tools/core-panel-test.mjs; else echo "   (jsdom nahi → core-panel test skip; UI gate ke liye: npm i -D jsdom)"; fi
npm run build >/dev/null 2>&1
[ -s dist/index.html ] || { echo "❌ vite build fail"; exit 1; }

echo "── 2/6 java → dex ──"
rm -rf "$W"; mkdir -p "$W/java" "$W/dexout" "$W/apk_root/assets/www"
cd "$NAT"
find src -name '*.java' > "$W/srcs.txt"
javac --release 11 -encoding UTF-8 -nowarn -classpath "$AJ" -d "$W/java" @"$W/srcs.txt"
d8 --lib "$AJ" --release --min-api 24 --output "$W/dexout" $(find "$W/java" -name '*.class') 
cp "$W/dexout/classes.dex" "$W/apk_root/classes.dex"

echo "── 3/6 manifest + res (version $VER / build $CODE) ──"
sed -e "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$CODE\"/" \
    -e "s/android:versionName=\"[^\"]*\"/android:versionName=\"$VER\"/" \
    AndroidManifest.xml > "$W/Manifest_pro6.xml"
grep -q "versionCode=\"$CODE\"" "$W/Manifest_pro6.xml" || { echo "❌ manifest me version patch nahi hua"; exit 1; }
# 🚪 v6.6.15: source manifest ko bhi sync karo — warna tools/verify-apk.sh ka
#    "APK version == source manifest" gate hamesha fail hota (build sirf work-dir copy patch karta tha)
sed -i -e "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$CODE\"/" \
       -e "s/android:versionName=\"[0-9.]*\"/android:versionName=\"$VER\"/" AndroidManifest.xml
aapt2 compile --dir res -o "$W/res.zip" >/dev/null
aapt2 link -I "$AJ" --manifest "$W/Manifest_pro6.xml" -o "$W/base.apk" "$W/res.zip" >/dev/null

echo "── 4/6 assets/www (web app + clips, STORED 0%) ──"
cp -a "$REPO"/dist/. "$W/apk_root/assets/www/"
cp -a "$MEDIA"/www/. "$W/apk_root/assets/www/"
[ -f "$W/apk_root/assets/www/motion_videos/clip_7.webm" ] || { echo "❌ clips dist me nahi gaye"; exit 1; }
grep -q "motion_videos" "$W/apk_root/assets/www/index.html" 2>/dev/null || true
WWW=$(find "$W/apk_root/assets/www" -type f | wc -l); WSIZE=$(du -sm "$W/apk_root/assets/www" | cut -f1)
echo "   www files=$WWW size=${WSIZE}MB"

echo "── 5/6 zip + align + sign ──"
cp "$W/base.apk" "$W/pkg.apk"
( cd "$W/apk_root" && zip -q -0 -X -r "$W/pkg.apk" assets classes.dex )
zipalign -f -p 4 "$W/pkg.apk" "$W/aligned.apk"
apksigner sign --ks "$KS" --ks-key-alias apexkey --ks-pass "pass:$KSP" --key-pass "pass:$KSP" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" "$W/aligned.apk"
apksigner verify "$OUT" >/dev/null
cp -f "$OUT" /var/tmp/preview_bundle/APEX-AI-Pro.apk 2>/dev/null || true

echo "── 6/6 gate ──"
bash "$REPO/tools/verify-apk.sh" "$OUT"
echo
echo "📦 APK ready: $OUT  ·  v$VER / build $CODE  ·  $(stat -c%s "$OUT") B  ·  md5 $(md5sum "$OUT" | cut -d' ' -f1)"
