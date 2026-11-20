#!/usr/bin/env bash
# Compila la app iOS en Release con la configuración de producción.
#
# Se corre desde la raíz del repo:
#   npm run ios:archive   → genera mobile/ios/build/Omero.xcarchive (sin subir nada)
#   npm run ios:upload    → archiva y sube el build a App Store Connect (TestFlight)
#
# Variables opcionales:
#   BUILD_NUMBER   número de build (default: fecha y hora AAMMDDhhmm, siempre creciente)
#   SKIP_PODS=1    no correr `pod install`
#   TEAM_ID        team de Apple (default: el del proyecto, 2582MLZ4GP)
#
# Las variables EXPO_PUBLIC_* se fijan acá y pisan a .env / .env.local: el build de
# producción nunca apunta a tu Mac aunque tengas un .env.local de desarrollo.
set -euo pipefail

MODE="${1:-archive}"
[[ "$MODE" == "archive" || "$MODE" == "upload" ]] || { echo "Uso: ios-release.sh [archive|upload]"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"
WORKSPACE="ios/Omero.xcworkspace"
SCHEME="Omero"
ARCHIVE="ios/build/Omero.xcarchive"
EXPORT_DIR="ios/build/export"
TEAM_ID="${TEAM_ID:-2582MLZ4GP}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%y%m%d%H%M)}"

export EXPO_PUBLIC_API_URL="https://omero-finance.vercel.app"
export EXPO_PUBLIC_DATA_SOURCE="api"
export EXPO_PUBLIC_VOICE_SOURCE="api"
export NODE_ENV="production"

command -v xcodebuild >/dev/null || { echo "✗ Falta Xcode (xcodebuild)."; exit 1; }
if [[ -z "${SKIP_PODS:-}" ]]; then
  command -v pod >/dev/null || { echo "✗ Falta CocoaPods. Instalalo con: brew install cocoapods"; exit 1; }
fi

if [[ ! -d node_modules ]]; then
  echo "▸ npm install (mobile)"
  npm install
fi

[[ -d "$WORKSPACE" ]] || { echo "No existe $WORKSPACE. Generalo con: npx expo prebuild --platform ios"; exit 1; }

if [[ -z "${SKIP_PODS:-}" ]]; then
  echo "▸ pod install"
  (cd ios && pod install)
fi

echo "▸ Archivando (build $BUILD_NUMBER, API $EXPO_PUBLIC_API_URL)"
rm -rf "$ARCHIVE"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  archive

# Verificación: el bundle JS debe apuntar a producción y no a una IP local.
BUNDLE="$(find "$ARCHIVE" -name main.jsbundle | head -n 1)"
[[ -n "$BUNDLE" ]] || { echo "✗ No encontré main.jsbundle en el archivo."; exit 1; }
if grep -aq "192\.168\.\|localhost:3" "$BUNDLE"; then
  echo "✗ El bundle contiene una URL local. Revisá tus .env* antes de publicar."; exit 1
fi
grep -aq "omero-finance.vercel.app" "$BUNDLE" || { echo "✗ El bundle no apunta a $EXPO_PUBLIC_API_URL."; exit 1; }
echo "✓ Bundle apunta a producción"

if [[ "$MODE" == "archive" ]]; then
  echo "✓ Listo: $PWD/$ARCHIVE"
  echo "  Para subirlo: abrí Xcode → Window → Organizer → Distribute App, o corré npm run ios:upload desde la raíz"
  exit 0
fi

PLIST="ios/build/ExportOptions.plist"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST_EOF

echo "▸ Subiendo a App Store Connect"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$PLIST" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates
echo "✓ Subido. Esperá unos minutos a que App Store Connect lo procese y elegilo en TestFlight."
