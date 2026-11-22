// "npx cap add android" sonrası çalıştırın: npm run android:patch
import fs from 'node:fs';
const f = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(f)) { console.error('Önce: npm run cap:add:android'); process.exit(1); }
let x = fs.readFileSync(f, 'utf8');
const perms = ['INTERNET', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'CAMERA', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'POST_NOTIFICATIONS', 'READ_CONTACTS', 'USE_BIOMETRIC', 'USE_FINGERPRINT', 'FOREGROUND_SERVICE', 'WAKE_LOCK'];
let add = perms.filter((p) => !x.includes(`android.permission.${p}"`)).map((p) => `    <uses-permission android:name="android.permission.${p}" />`).join('\n');
add += `\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />`;
if (!x.includes('<queries>'))
  add += `\n    <queries>
        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>
        <intent><action android:name="android.speech.RecognitionService" /></intent>
        <intent><action android:name="android.intent.action.VIEW" /><data android:mimeType="application/pdf" /></intent>
    </queries>`;
x = x.replace('<application', add + '\n\n    <application');
fs.writeFileSync(f, x); console.log('AndroidManifest güncellendi.');
