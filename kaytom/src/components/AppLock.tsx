import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { applyPrivacy, biometricUnlock, checkPin, isNative, lockEnabled, lockoutSeconds } from '../lib/security';

export default function AppLock({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(lockEnabled());
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { void applyPrivacy(); }, []);

  // Telefon uygulaması arka plana geçince kilitle
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      const h = await App.addListener('appStateChange', ({ isActive }) => { if (!isActive && lockEnabled()) setLocked(true); });
      remove = () => void h.remove();
    });
    return () => remove?.();
  }, []);

  const bio = useCallback(async () => { if (await biometricUnlock(t('security.biometricReason'))) { setLocked(false); setPin(''); setMsg(''); } }, [t]);
  useEffect(() => { if (locked && isNative()) void bio(); }, [locked, bio]);

  const submit = async () => {
    const wait = lockoutSeconds(); if (wait > 0) return setMsg(t('security.tooMany', { s: wait }));
    if (await checkPin(pin)) { setLocked(false); setPin(''); setMsg(''); }
    else { setPin(''); const w = lockoutSeconds(); setMsg(w > 0 ? t('security.tooMany', { s: w }) : t('security.wrongPin')); }
  };

  if (!locked) return <>{children}</>;
  return (
    <main className="h-full grid place-items-center p-6 safe-top safe-bottom">
      <div className="w-full max-w-xs grid gap-4 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-brand grid place-items-center text-brand-ink"><Lock /></div>
        <h1 className="text-xl font-extrabold">{t('security.enterPin')}</h1>
        <input type="password" inputMode="numeric" autoFocus maxLength={6} value={pin} aria-label={t('security.pin')}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && void submit()}
          className="rounded-xl border border-line bg-panel px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-brand" />
        {msg && <p role="alert" className="text-sm text-red-500">{msg}</p>}
        <button onClick={submit} disabled={pin.length < 4} className="rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-brand-ink font-bold py-3">{t('security.unlock')}</button>
        {isNative() && <button onClick={bio} className="text-sm text-muted hover:text-ink">{t('security.useBiometric')}</button>}
      </div>
    </main>
  );
}
