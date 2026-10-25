#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 🔎 APEX APK VERIFIER — "App keeps stopping" jaisa bug dobara na jaaye.
#    Kya check karta hai:
#      1) manifest ka launchable-activity RELATIVE (.MainActivity) to nahi — package
#         v3→pro6 swap par wahi toot'ta tha (v6.6.3–6.6.7 crash ka asli karan)
#      2) wo class classes.dex me WAQAI maujood hai? (ActivityClassNotFound = crash)
#      3) provider authority == package + ".videoprovider" (MainActivity getPackageName())
#      4) index.html ke JS/CSS refs APK ke andar maujood hain?
#      5) assets/www compressed = 0 (0% stored rule)
#      6) signature + same APEX cert (zero-conflict update)
#      7) APK version == source manifest version
#    Use:  ./tools/verify-apk.sh [apk]     (exit 0 = phone par chalega)
# ═══════════════════════════════════════════════════════════════════════════
set -u
APK="${1:-/home/user/APEX-AI-Pro.apk}"
BT="${ANDROID_BT:-/var/tmp/android-sdk/build-tools/34.0.0}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fail=0; ok(){ echo "  ✅ $1"; }; bad(){ echo "  ❌ $1"; fail=1; }
[ -f "$APK" ] || { echo "APK nahi mila: $APK"; exit 2; }
"$BT/aapt2" dump badging "$APK" > "$TMP/badging.txt" 2>/dev/null
"$BT/aapt2" dump xmltree --file AndroidManifest.xml "$APK" > "$TMP/tree.txt" 2>/dev/null
unzip -q -o "$APK" classes.dex -d "$TMP" 2>/dev/null
"$BT/dexdump" "$TMP/classes.dex" 2>/dev/null | grep -o "L[a-zA-Z0-9_/$]*;" | sort -u > "$TMP/classes.txt"
PKG=$(grep -o "package: name='[^']*'" "$TMP/badging.txt" | head -1 | sed "s/.*name='//;s/'//")
ACT=$(grep -o "launchable-activity: name='[^']*'" "$TMP/badging.txt" | head -1 | sed "s/.*name='//;s/'//")
VCODE=$(grep -o "versionCode='[0-9]*'" "$TMP/badging.txt" | head -1 | tr -dc 0-9)
VNAME=$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" "$TMP/badging.txt" | head -1)
[ -n "$PKG" ] && ok "package = $PKG  (v$VNAME / build $VCODE)" || bad "package nahi mila"
# 🐞 6.6.12: gate sirf *consistency* dekhta tha — v3 package wala APK bhi pass ho gaya
#    hota tha, aur wo phone par update ki jagah DUSRA app ban kar baithta. Ab id lock hai.
if [ "$PKG" = "com.apexhumanoid.pro6" ]; then ok "app id = com.apexhumanoid.pro6 (zero-conflict update rule)"; else bad "app id pro6 NAHI ($PKG) — isse update nahi, dusra app install hoga. FIX: android-native/AndroidManifest.xml ka package"; fi
case "$ACT" in
  .*) bad "launchable-activity RELATIVE hai ($ACT) — package swap par ClassNotFound crash";;
  "") bad "launchable-activity nahi mila (launcher intent filter?)";;
  *) ok "launchable-activity fully-qualified: $ACT";;
esac
resolve(){ local n="$1"; case "$n" in .*) echo "$PKG$n";; *|'') echo "$n";; esac; }
ACTF=$(resolve "$ACT")
DESC="L${ACTF//.//};"
if [ -n "$ACT" ]; then
  grep -qx "$DESC" "$TMP/classes.txt" && ok "wo class dex me maujood: $DESC" || bad "CRASH BUG: $ACT classes.dex me NAHI (ActivityClassNotFound → 'keeps stopping')"
fi
AUTH=$(grep -o 'android:authorities([^)]*)="[^"]*"' "$TMP/tree.txt" | sed 's/.*="//;s/"//' | head -1)
PROV=$(awk '/E: provider/{f=1} f && /android:name\(/{print; exit}' "$TMP/tree.txt" | sed 's/.*="//;s/" (Raw.*//')
if [ -n "$AUTH" ] && [ "$AUTH" != "com.apexhumanoid.pro6.videoprovider" ]; then bad "authority pro6 wali nahi: $AUTH (zero-conflict rule)"; fi
if [ -n "$AUTH" ]; then
  case "$AUTH" in "$PKG".*) ok "provider authority package se match: $AUTH";; *) bad "provider authority ($AUTH) package ($PKG) se alag — FileProvider share fail hoga";; esac
  PROVF=$(resolve "$PROV")
  if [ -n "$PROVF" ] && [ "$PROVF" != "$AUTH" ]; then
    PDESC="L${PROVF//.//};"
    grep -qx "$PDESC" "$TMP/classes.txt" && ok "provider class dex me: $PDESC" || bad "provider class NAHI dex me: $PDESC"
  fi
else
  bad "koi <provider> declaration  nahi mila (videoprovider)"
fi
if unzip -p "$APK" assets/www/index.html > "$TMP/index.html" 2>/dev/null; then
  MISS=0
  for ref in $(grep -oE '(src|href)="[^"]*index-[A-Za-z0-9_-]+\.(js|css)"' "$TMP/index.html" | sed 's/.*="//;s/"//'); do
    name="assets/www/${ref#./}"
    unzip -l "$APK" "$name" >/dev/null 2>&1 || { bad "index.html ka ref APK me gayab: $name"; MISS=1; }
  done
  [ $MISS -eq 0 ] && ok "index.html ke saare bundle refs APK me hain"
else
  bad "assets/www/index.html missing"
fi
COMP=$(python3 -c "
import zipfile
z=zipfile.ZipFile('$APK')
print(sum(1 for i in z.infolist() if i.filename.startswith('assets/www') and i.compress_type!=0))
" 2>/dev/null || echo "?")
[ "$COMP" = "0" ] && ok "assets/www compressed entries = 0 (0% stored rule)" || bad "assets/www me $COMP compressed entries (0% stored rule toota)"
"$BT/apksigner" verify "$APK" >/dev/null 2>&1 && ok "signature verify OK" || bad "signature verify FAIL"
"$BT/apksigner" verify --print-certs "$APK" 2>/dev/null | grep -q "14568bc2eb0381e337e13571d4cbc4bdd4b6495e0f54668b337c0c4f2dfb87ab" && ok "signer = APEX cert (apex-v3.keystore) → update hi hoga" || bad "signer certificate ALAG (zero-conflict rule toota)"
SRC_MAN="${SRC_MANIFEST:-/home/user/android-native/AndroidManifest.xml}"
if [ -f "$SRC_MAN" ]; then
  grep -q "android:versionCode=\"$VCODE\"" "$SRC_MAN" && grep -q "android:versionName=\"$VNAME\"" "$SRC_MAN" && ok "APK version == source manifest ($VNAME/$VCODE)" || bad "version mismatch: source manifest vs APK"
  grep -q 'android:name="com.apexhumanoid.v3.MainActivity"' "$SRC_MAN" && ok "source manifest me fully-qualified activity name ✅" || bad "source manifest me activity name relative hai — FIX KARO"
fi
echo
[ $fail -eq 0 ] && echo "🔎 VERDICT: APK install + launch ke liye SAHI hai ✅" || echo "🔎 VERDICT: ❌ ye APK phone par crash karega — upar wali line theek karo"
exit $fail
