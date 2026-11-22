#!/usr/bin/env bash
# Gerekli: Node 20+, JDK 17, Android SDK (Android Studio)
set -e
[ -f .env ] || { cp .env.example .env; echo ".env olusturuldu; anahtarlari yazip tekrar calistirin"; exit 1; }
npm install
npm run build
[ -d android ] || npx cap add android
node scripts/patch-android.mjs || true
npx cap sync android
(cd android && ./gradlew assembleDebug)
echo "HAZIR: android/app/build/outputs/apk/debug/app-debug.apk"
