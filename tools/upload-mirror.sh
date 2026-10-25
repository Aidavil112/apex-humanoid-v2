#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 🪞 MIRROR UPLOAD — jab GoFile "noServer" de de tab ₹0 doosre hosts try karta hai:
#    1) catbox.moe  (200 MB tak, permanent)   2) pixeldrain.com (direct link)
#    usage: bash tools/upload-mirror.sh [apk]
#    Result /var/tmp/mirror-latest.json me (docs update isi se karo).
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
APK="${1:-/home/user/APEX-AI-Pro.apk}"
[ -f "$APK" ] || { echo "APK nahi: $APK"; exit 2; }
SIZE=$(stat -c%s "$APK"); MD5=$(md5sum "$APK" | cut -d' ' -f1)
echo "• local: $APK size=$SIZE md5=$MD5"

echo "── try 1: catbox.moe ──"
CB=$(curl -sS -m 1500 -F "reqtype=fileupload" -F "time=72h" -F "fileToUpload=@$APK;filename=$(basename "$APK")" https://catbox.moe/user/api.php | tr -d '\r\n"')
if printf '%s' "$CB" | grep -q '^https://files.catbox.moe/'; then
  echo "LINK=$CB"; echo "{\"host\":\"catbox\",\"link\":\"$CB\",\"size\":$SIZE,\"md5\":\"$MD5\"}" > /var/tmp/mirror-latest.json
  HS=$(curl -sSI -m 60 "$CB" | awk 'BEGIN{IGNORECASE=1}/content-length/{print $2}' | tr -d '\r')
  echo "   remote size header = ${HS:-?} (local $SIZE)"
  exit 0
fi
echo "⚠️ catbox fail: $(printf '%s' "$CB" | head -c 160)"

echo "── try 2: pixeldrain ──"
PD=$(curl -sS -m 1500 -T "$APK" "https://pixeldrain.com/api/file/$(basename "$APK")" || echo '{}')
ID=$(printf '%s' "$PD" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
if [ -n "$ID" ]; then
  echo "LINK=https://pixeldrain.com/u/$ID"; echo "RAW =https://pixeldrain.com/api/file/$ID?download"
  echo "{\"host\":\"pixeldrain\",\"link\":\"https://pixeldrain.com/u/$ID\",\"raw\":\"https://pixeldrain.com/api/file/$ID?download\",\"size\":$SIZE,\"md5\":\"$MD5\"}" > /var/tmp/mirror-latest.json
  exit 0
fi
echo "⚠️ pixeldrain bhi fail: $(printf '%s' "$PD" | head -c 200)"
exit 4
