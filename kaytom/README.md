# KAYTOM – Kurulum
1. Supabase: SQL Editor -> supabase_schema.sql calistir. Auth -> Email Templates: mail metnine {{ .Token }} (6 haneli kod) ekle.
2. .env.example -> .env, URL + anon key yaz.
3. Gelistirme: npm install && npm run dev
4. Windows .exe: BUILD-WINDOWS.bat (cift tikla)  -> release\KAYTOM-Setup-0.1.0.exe
5. Android .apk: ./build-android.sh  -> android/app/build/outputs/apk/debug/app-debug.apk
6. Kurulumsuz: projeyi GitHub'a yukle, Settings > Secrets'a VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ekle, Actions > "KAYTOM Build" > Run workflow. Ciktilar "Artifacts" altinda: KAYTOM-windows-exe, KAYTOM-android-apk.
Kisi esleme (yalniz telefon uygulamasi): rehberdeki e-postalarin SHA-256 ozeti eslestirilir; kullanici izin verirse bulunanlar otomatik "Kisileriniz"e kaydedilir.

## Hızlı yol: tarayıcıdan kurulum (PWA) – telefon + PC
1. Projeyi GitHub'a yükle. netlify.com > Add new site > Import from Git > bu repo.
2. Netlify > Site settings > Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
3. Deploy sonrası verilen adresi telefonda (Chrome: menü > "Ana ekrana ekle / Uygulamayı yükle"; iPhone Safari: Paylaş > "Ana Ekrana Ekle") ve PC'de (Chrome/Edge adres çubuğundaki "Yükle" simgesi) aç.
Not: Rehber eşleştirme yalnızca APK/native sürümde çalışır.

## Arama (sesli / görüntülü)
Sohbet başlığındaki telefon ve kamera simgeleri. Karşı taraf çalar (zil + bildirim), arayan "Aranıyor… / Çalıyor…" görür. WebRTC + Supabase Realtime (calls, call_signals tabloları; supabase_schema.sql sonunda).
- Farklı ağlarda (mobil veri / farklı Wi-Fi) TURN gerekir. Kalıcı çözüm için ücretsiz hesap açın: metered.ca (ücretsiz plan) veya Cloudflare Realtime TURN; verdiği URL/kullanıcı/şifreyi .env içindeki VITE_TURN_* (veya JSON için VITE_ICE_SERVERS) alanlarına yazın ve yeniden derleyin. Hiçbiri yazılmazsa herkese açık yedek röle denenir (güvenilir değil).
- Uygulama tamamen kapalıyken çalmaz: bunun için FCM/APNs push (Firebase projesi) gerekir; henüz yok.
- Yalnızca birebir sohbetlerde; grup araması yok.
