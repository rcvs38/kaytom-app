import { Capacitor } from '@capacitor/core';

const K_LOCK = 'kaytom.lockOn', K_HASH = 'kaytom.pinHash', K_SALT = 'kaytom.pinSalt', K_PRIV = 'kaytom.privacyScreen', K_FAIL = 'kaytom.pinFails';
export const isNative = () => Capacitor.isNativePlatform();
export const lockEnabled = () => localStorage.getItem(K_LOCK) === '1' && !!localStorage.getItem(K_HASH);
export const privacyEnabled = () => localStorage.getItem(K_PRIV) !== '0';

async function hash(pin: string, salt: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function setPin(pin: string) {
  const salt = crypto.randomUUID();
  localStorage.setItem(K_SALT, salt); localStorage.setItem(K_HASH, await hash(pin, salt)); localStorage.setItem(K_LOCK, '1');
}
export function disableLock() { localStorage.removeItem(K_LOCK); localStorage.removeItem(K_HASH); localStorage.removeItem(K_SALT); }
export async function checkPin(pin: string): Promise<boolean> {
  const ok = (await hash(pin, localStorage.getItem(K_SALT) ?? '')) === localStorage.getItem(K_HASH);
  if (ok) localStorage.removeItem(K_FAIL); else localStorage.setItem(K_FAIL, JSON.stringify({ n: failState().n + 1, t: Date.now() }));
  return ok;
}
function failState(): { n: number; t: number } { try { return JSON.parse(localStorage.getItem(K_FAIL) ?? '') ?? { n: 0, t: 0 }; } catch { return { n: 0, t: 0 }; } }
/** 5 yanlış denemeden sonra her yanlışta 30 sn bekletir. Kalan saniyeyi döner. */
export function lockoutSeconds(): number {
  const { n, t } = failState(); if (n < 5) return 0;
  return Math.max(0, Math.ceil((t + 30_000 - Date.now()) / 1000));
}

export async function setPrivacy(on: boolean) {
  localStorage.setItem(K_PRIV, on ? '1' : '0');
  if (!isNative()) return;
  const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
  if (on) await PrivacyScreen.enable(); else await PrivacyScreen.disable();
}
export async function applyPrivacy() { if (isNative() && privacyEnabled()) await setPrivacy(true); }

export async function biometricUnlock(reason: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const a = await NativeBiometric.isAvailable(); if (!a.isAvailable) return false;
    await NativeBiometric.verifyIdentity({ reason, title: 'KAYTOM' });
    return true;
  } catch { return false; }
}
