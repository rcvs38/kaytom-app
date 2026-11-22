import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, LogOut, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LANGS, setLanguage, type LangCode } from '../i18n';
import { applyTheme, getTheme, type ThemeMode } from '../lib/theme';
import { setSoundEnabled, setSystemEnabled, soundEnabled, systemEnabled } from '../lib/notify';
import type { Profile } from '../types';
import Avatar from './Avatar';
import SecuritySection from './SecuritySection';

interface Props { profile: Profile; onClose: () => void; onSaved: () => void | Promise<void> }

export default function SettingsPanel({ profile, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(profile.display_name);
  const [about, setAbout] = useState(profile.about);
  const [theme, setTheme] = useState<ThemeMode>(getTheme());
  const [sound, setSound] = useState(soundEnabled());
  const [sys, setSys] = useState(systemEnabled());
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    await supabase.from('profiles').update({ display_name: name.trim() || profile.display_name, about: about.trim() }).eq('id', profile.id);
    await onSaved(); setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const upload = async (file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) return;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
    await onSaved();
  };

  const seg = (active: boolean) => `flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${active ? 'bg-brand text-brand-ink' : 'bg-bubbleIn text-ink hover:bg-line'}`;
  const row = 'grid gap-2';
  const lbl = 'text-sm font-bold text-muted';

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex justify-end" onClick={onClose}>
      <aside role="dialog" aria-modal className="w-full max-w-md h-full bg-panel overflow-y-auto scroll-thin safe-top safe-bottom" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-xl font-extrabold">{t('settings.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')}><X /></button>
        </header>
        <div className="p-5 grid gap-6">
          <section className="grid gap-4">
            <h3 className="font-extrabold">{t('settings.profile')}</h3>
            <div className="flex items-center gap-4">
              <Avatar name={name} url={profile.avatar_url} size={72} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-bubbleIn">
                <Camera size={16} />{t('settings.changePhoto')}
              </button>
              <span className="text-sm text-muted">@{profile.username}</span>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            <label className={row}><span className={lbl}>{t('settings.name')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-line bg-panel px-4 py-2.5 outline-none focus:border-brand" /></label>
            <label className={row}><span className={lbl}>{t('settings.about')}</span>
              <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} placeholder={t('settings.defaultAbout')} className="rounded-xl border border-line bg-panel px-4 py-2.5 outline-none focus:border-brand" /></label>
            <button onClick={save} className="rounded-xl bg-brand hover:bg-brand-hover text-brand-ink font-bold py-2.5 transition-colors">
              {saved ? t('settings.saved') : t('common.save')}
            </button>
          </section>

          <section className={row}>
            <h3 className="font-extrabold">{t('settings.language')}</h3>
            <div className="flex gap-2" role="radiogroup">
              {LANGS.map((l) => (
                <button key={l.code} role="radio" aria-checked={i18n.language.slice(0, 2) === l.code}
                  onClick={() => setLanguage(l.code as LangCode)} className={seg(i18n.language.slice(0, 2) === l.code)}>{l.label}</button>
              ))}
            </div>
          </section>

          <section className={row}>
            <h3 className="font-extrabold">{t('settings.theme')}</h3>
            <div className="flex gap-2" role="radiogroup">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
                <button key={m} role="radio" aria-checked={theme === m} onClick={() => { setTheme(m); applyTheme(m); }} className={seg(theme === m)}>{t(`settings.${m}`)}</button>
              ))}
            </div>
          </section>

          <section className={row}>
            <h3 className="font-extrabold">{t('settings.notifications')}</h3>
            <label className="flex items-center justify-between"><span>{t('settings.sound')}</span>
              <input type="checkbox" className="w-5 h-5 accent-[#00B4D8]" checked={sound} onChange={(e) => { setSound(e.target.checked); setSoundEnabled(e.target.checked); }} /></label>
            <label className="flex items-center justify-between"><span>{t('settings.desktopNotifications')}</span>
              <input type="checkbox" className="w-5 h-5 accent-[#00B4D8]" checked={sys} onChange={async (e) => setSys(await setSystemEnabled(e.target.checked))} /></label>
          </section>

          <SecuritySection />

          <button onClick={() => supabase.auth.signOut()} className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 font-semibold hover:bg-bubbleIn">
            <LogOut size={18} />{t('auth.logout')}
          </button>
        </div>
      </aside>
    </div>
  );
}
