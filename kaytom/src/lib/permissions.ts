import { Capacitor } from '@capacitor/core';
import { rememberAnswer, syncPhoneContacts } from './contacts';

const KEY = 'kaytom.startupPermsDone';
const native = Capacitor.isNativePlatform();

async function probe(c: MediaStreamConstraints) {
  try { (await navigator.mediaDevices.getUserMedia(c)).getTracks().forEach((t) => t.stop()); } catch { /* kullanıcı reddetti: sorun değil */ }
}

/** Uygulama ilk açıldığında tüm izinleri sırayla ister: mikrofon → kamera → rehber → bildirim. */
export async function requestStartupPermissions(): Promise<void> {
  if (localStorage.getItem(KEY)) return;
  localStorage.setItem(KEY, '1');
  if (navigator.mediaDevices?.getUserMedia) { await probe({ audio: true }); await probe({ video: true }); }
  if (!native) return;
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    const r = await Contacts.requestPermissions();
    rememberAnswer(r.contacts === 'granted');
  } catch { rememberAnswer(false); }
  try { const { LocalNotifications } = await import('@capacitor/local-notifications'); await LocalNotifications.requestPermissions(); } catch { /* bildirim izni yok */ }
}

export async function startupPermissionsThenSync() { await requestStartupPermissions(); await syncPhoneContacts(); }
