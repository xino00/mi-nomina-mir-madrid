#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIRECTORY"
BUILD_VARIANT="${1:-debug}"
if [[ "$BUILD_VARIANT" != debug && "$BUILD_VARIANT" != release ]]; then
  echo 'Uso: npm run android:build -- [debug|release]' >&2
  exit 1
fi
: "${JAVA_HOME:?Configura JAVA_HOME con JDK 21}"
: "${ANDROID_HOME:?Configura ANDROID_HOME con SDK 36 y Build Tools 35.0.0}"
if [[ "$BUILD_VARIANT" == release && ! -f "${NOMINA_SIGNING_PROPERTIES:-}" ]]; then
  echo 'Para release, indica NOMINA_SIGNING_PROPERTIES con un archivo privado de firma. Consulta docs/ANDROID.md.' >&2
  exit 1
fi
export PATH="$JAVA_HOME/bin:$PATH"
RELEASE_VERSION="$(node --input-type=module -e 'import fs from "node:fs";const version=JSON.parse(fs.readFileSync("package.json","utf8")).version;if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error("Versión inválida");process.stdout.write(version)')"
npm run check:public
npm run build
npx --no-install cap sync android
GRADLE_VARIANT="${BUILD_VARIANT^}"
cd android
./gradlew ":app:assemble$GRADLE_VARIANT" ":app:lint$GRADLE_VARIANT" :app:assembleDebugAndroidTest --no-daemon --console=plain
cd "$PROJECT_DIRECTORY"
mkdir -p releases
RELEASE_APK="releases/MiNomina-$RELEASE_VERSION-$BUILD_VARIANT.apk"
cp "android/app/build/outputs/apk/$BUILD_VARIANT/app-$BUILD_VARIANT.apk" "$RELEASE_APK"
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose "$RELEASE_APK"
"$ANDROID_HOME/build-tools/35.0.0/zipalign" -c -P 16 4 "$RELEASE_APK" > /dev/null
python3 scripts/verify-android-16kb.py "$RELEASE_APK"
sha256sum "$RELEASE_APK" > "$RELEASE_APK.sha256"
echo "APK generado: $RELEASE_APK"
