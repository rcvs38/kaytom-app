import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

/** Parolasız giriş: e-postaya gelen 6 haneli tek kullanımlık kod. */
export default function AuthScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: { display_name: name.trim(), username: username.trim().toLowerCase() } },
    });
    setBusy(false);
    if (error) return setMsg({ text: t('auth.generic'), ok: false });
    setStep('code'); setMsg({ text: t('auth.codeSent', { email }), ok: true });
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg({ text: t('auth.invalid'), ok: false });
  };

  const field = 'w-full rounded-xl border border-line bg-panel px-4 py-3 outline-none focus:border-brand';
  return (
    <main className="h-full overflow-auto grid place-items-center p-6 safe-top safe-bottom">
      <form onSubmit={step === 'email' ? send : verify} className="w-full max-w-sm grid gap-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-brand grid place-items-center text-brand-ink font-extrabold text-xl">K</div>
          <div><div className="text-xl font-extrabold">{t('app.name')}</div><div className="text-sm text-muted">{t('app.tagline')}</div></div>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.login')}</h1>
        {step === 'email' ? (<>
          <input className={field} type="email" autoComplete="email" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={field} placeholder={t('auth.displayNameNew')} value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} placeholder={t('auth.username')} value={username} onChange={(e) => setUsername(e.target.value)} pattern="[A-Za-z0-9_.]{3,24}" />
        </>) : (
          <input className={`${field} text-center text-2xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={8}
            placeholder={t('auth.code')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required autoFocus />
        )}
        {msg && <p role="alert" className={msg.ok ? 'text-brand-hover text-sm' : 'text-red-500 text-sm'}>{msg.text}</p>}
        <button disabled={busy} className="rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-60 text-brand-ink font-bold py-3 transition-colors">
          {step === 'email' ? t('auth.sendCode') : t('auth.verify')}
        </button>
        {step === 'code' && <button type="button" onClick={() => { setStep('email'); setCode(''); setMsg(null); }} className="text-sm text-muted hover:text-ink">{t('auth.changeEmail')}</button>}
      </form>
    </main>
  );
}
