#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 🔧 APEX BUILD TOOLCHAIN (sandbox me /var/tmp bekaar me saaf ho jaata hai — isliye
#    ye script 2 minute me JDK + Android build-tools + platform dobara la deti hai).
#    /home/user me isko install NAHI karte: 500 MB workspace snapshot cap tod dega.
#    usage: bash tools/setup-toolchain.sh      (phir: bash tools/build-apk.sh …)
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
ROOT=/var/tmp
JDK_DIR="$ROOT/jdk17"
SDK_DIR="$ROOT/android-sdk"
BT="$SDK_DIR/build-tools/34.0.0"
PLAT="$SDK_DIR/platforms/android-34/android.jar"
if [ -x "$BT/aapt2" ] && [ -x "$BT/apksigner" ] && [ -x "$JDK_DIR/bin/javac" ] && [ -f "$PLAT" ]; then
  echo "✅ toolchain already ready ($BT)"; exit 0
fi
mkdir -p "$ROOT/dl"
if [ ! -x "$JDK_DIR/bin/javac" ]; then
  echo "• JDK 17 (Adoptium)…"
  curl -sSL -o "$ROOT/dl/jdk.tar.gz" "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p "$JDK_DIR" && tar xzf "$ROOT/dl/jdk.tar.gz" -C "$JDK_DIR" --strip-components=1
  "$JDK_DIR/bin/javac" -version
fi
if [ ! -x "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "• Android cmdline-tools…"
  curl -sSL -o "$ROOT/dl/ct.zip" "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  mkdir -p "$SDK_DIR/cmdline-tools" && unzip -qo "$ROOT/dl/ct.zip" -d "$SDK_DIR/cmdline-tools"
  rm -rf "$SDK_DIR/cmdline-tools/latest" && mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
fi
export JAVA_HOME="$JDK_DIR"
SM="$SDK_DIR/cmdline-tools/latest/bin/sdkmanager"
echo "• licenses + build-tools;34.0.0 + platforms;android-34…"
yes 2>/dev/null | "$SM" --sdk_root="$SDK_DIR" --licenses >/dev/null 2>&1 || true
"$SM" --sdk_root="$SDK_DIR" "build-tools;34.0.0" "platforms;android-34" >/dev/null 2>&1
[ -x "$BT/aapt2" ] && [ -x "$BT/apksigner" ] && [ -x "$BT/zipalign" ] && [ -x "$BT/d8" ] && [ -f "$PLAT" ] || { echo "❌ install adhoora (check: $BT)"; exit 1; }
echo "✅ toolchain ready: $BT + $JDK_DIR"
