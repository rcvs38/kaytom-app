import { Capacitor } from '@capacitor/core';
const SOUND = 'kaytom.sound';
const SYSTEM = 'kaytom.systemNotif';

export const soundEnabled = () => localStorage.getItem(SOUND) !== '0';
export const setSoundEnabled = (v: boolean) => localStorage.setItem(SOUND, v ? '1' : '0');
export const systemEnabled = () => localStorage.getItem(SYSTEM) === '1' && 'Notification' in window && Notification.permission === 'granted';

export async function setSystemEnabled(v: boolean): Promise<boolean> {
  if (!v) { localStorage.setItem(SYSTEM, '0'); return false; }
  if (!('Notification' in window)) return false;
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  localStorage.setItem(SYSTEM, perm === 'granted' ? '1' : '0');
  return perm === 'granted';
}

let ctx: AudioContext | null = null;
export function playBeep() {
  if (!soundEnabled()) return;
  try {
    ctx = ctx ?? new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.26);
  } catch { /* ses çalınamadı: sessizce geç */ }
}

export async function showSystemNotification(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
      if (p.display !== 'granted') return;
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2147483000), title, body }] });
    } catch { /* bildirim gösterilemedi */ }
    return;
  }
  if (systemEnabled()) new Notification(title, { body, tag: 'kaytom-msg' });
}
