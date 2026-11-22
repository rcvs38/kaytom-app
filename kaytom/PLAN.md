# KAYTOM – Proje Planı

## Faz 1 (bu iskelet – hazır)
- Vite + React + TS + Tailwind, Supabase istemcisi, i18n (TR/DE/EN), ilk açılış dil seçimi, açık/koyu tema
- Kayıt/Giriş, iki panelli responsive kabuk, sohbet listesi, birebir sohbet başlatma
- Gerçek zamanlı metin mesajı, tik durumları (tek / çift gri / çift turkuaz), yazıyor…, çevrimiçi/son görülme
- Sohbet içi arama, sesli + sistem bildirimi, ayarlar (dil, tema, profil, avatar, durum)
- Capacitor (iOS/Android) + Electron (Windows/macOS) yapılandırması, `supabase_schema.sql` (RLS + RPC + Storage)

## Faz 2
- Medya: resim/video/PDF yükleme + önizleme, MediaRecorder ile sesli mesaj (Storage `media` bucket hazır)
## Faz 3
- Grup arayüzü: oluşturma, üye ekle/çıkar, yönetici yetkisi, grup bilgisi (RPC'ler ve çeviri anahtarları hazır)
## Faz 4
- Push bildirimleri (FCM/APNs), mağaza ikonları, imzalı derlemeler
