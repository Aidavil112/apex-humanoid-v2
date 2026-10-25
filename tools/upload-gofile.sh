#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ☁️ GOFILE UPLOAD — APK ka ₹0 download link (guest account, koi login nahi).
#    usage: bash tools/upload-gofile.sh [apk]      → print karta hai: link + size + md5
#    Output /var/tmp/gf-latest.json me save hota hai (docs update ke liye).
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
APK="${1:-/home/user/APEX-AI-Pro.apk}"
[ -f "$APK" ] || { echo "APK nahi: $APK"; exit 2; }
SIZE=$(stat -c%s "$APK"); MD5=$(md5sum "$APK" | cut -d' ' -f1)
TOK=$(curl -sS -m 40 -X POST https://api.gofile.io/accounts | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' | head -1)
[ -n "$TOK" ] || { echo "❌ gofile guest token nahi mila (site down?)"; exit 1; }
SRV=$(curl -sS -m 40 -H "Authorization: Bearer $TOK" https://api.gofile.io/servers | grep -o '"name":"store[^"]*"' | head -1 | sed 's/.*"name":"//;s/"//' || true)
if [ -z "$SRV" ]; then
  # 24/10/2026: /servers kabhi-kabhi "noServer" deta hai (capacity) lekin store9 direct
  # upload karta hai — isliye pehle known stores try karo, tabhi haar maano.
  for cand in store9 store1 store2 store3 store7; do
    code=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "https://$cand.gofile.io/" 2>/dev/null || echo 000)
    if [ "$code" != "000" ]; then SRV="$cand"; echo "• /servers = noServer → direct store try: $SRV (http $code)"; break; fi
  done
fi
if [ -z "$SRV" ]; then
  echo "❌ GoFile ne koi server nahi diya aur direct stores bhi reachable nahi: $(printf '%s' "$SRVRAW" | head -c 120)"
  echo "   fallback: bash tools/upload-mirror.sh $APK"
  exit 3
fi
echo "• server=$SRV size=$SIZE md5=$MD5"
curl -sS -m 1500 -X POST "https://$SRV.gofile.io/contents/uploadfile" \
  -H "Authorization: Bearer $TOK" \
  -F "accessToken=$TOK" -F "file=@$APK;filename=$(basename "$APK")" > /var/tmp/gf-latest.json
LINK=$(sed -n 's/.*"downloadPage":"\([^"]*\)".*/\1/p' /var/tmp/gf-latest.json | head -1)
[ -n "$LINK" ] || { echo "❌ upload fail:"; head -c 400 /var/tmp/gf-latest.json; echo; exit 1; }
UPMD5=$(sed -n 's/.*"md5":"\([^"]*\)".*/\1/p' /var/tmp/gf-latest.json | head -1)
UPSIZE=$(sed -n 's/.*"size":\([0-9]*\).*/\1/p' /var/tmp/gf-latest.json | head -1)
echo "LINK=$LINK"
echo "remote size=$UPSIZE md5=$UPMD5  (local $SIZE / $MD5)"
[ "$UPMD5" = "$MD5" ] && echo "✅ remote copy byte-identical" || echo "⚠️ md5 mismatch — dobara upload karo"
