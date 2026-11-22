import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { disableLock, isNative, lockEnabled, privacyEnabled, setPin, setPrivacy } from '../lib/security';

export default function SecuritySection() {
  const { t } = useTranslation();
  const [lock, setLock] = useState(lockEnabled());
  const [priv, setPriv] = useState(privacyEnabled());
  const [pin, setPinVal] = useState('');
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState(false);
  const cb = 'w-5 h-5 accent-[#00B4D8]';

  return (
    <section className="grid gap-3">
      <h3 className="font-extrabold">{t('security.title')}</h3>
      <label className="flex items-center justify-between gap-3"><span>{t('security.lock')}</span>
        <input type="checkbox" className={cb} checked={lock || ask}
          onChange={(e) => { if (e.target.checked) { setAsk(true); setDone(false); } else { disableLock(); setLock(false); setAsk(false); } }} /></label>
      {ask && !lock && (
        <div className="flex gap-2">
          <input type="password" inputMode="numeric" maxLength={6} value={pin} placeholder={t('security.setPin')} onChange={(e) => setPinVal(e.target.value.replace(/\D/g, ''))}
            className="flex-1 rounded-xl border border-line bg-panel px-3 py-2 outline-none focus:border-brand" />
          <button disabled={pin.length < 4} onClick={async () => { await setPin(pin); setLock(true); setAsk(false); setPinVal(''); setDone(true); }}
            className="rounded-xl bg-brand text-brand-ink font-bold px-4 disabled:opacity-40">{t('security.savePin')}</button>
        </div>)}
      {done && <p className="text-sm text-brand-hover">{t('security.pinSaved')}</p>}
      <label className="flex items-center justify-between gap-3"><span>{t('security.privacyScreen')}</span>
        <input type="checkbox" className={cb} checked={priv} disabled={!isNative()} onChange={async (e) => { setPriv(e.target.checked); await setPrivacy(e.target.checked); }} /></label>
      {!isNative() && <p className="text-xs text-muted">{t('security.nativeOnly')}</p>}
    </section>
  );
}
