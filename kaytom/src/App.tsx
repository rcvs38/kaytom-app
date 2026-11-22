import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './lib/supabase';
import { hasChosenLanguage } from './i18n';
import LanguageSelect from './components/LanguageSelect';
import AuthScreen from './components/AuthScreen';
import AppShell from './components/AppShell';
import AppLock from './components/AppLock';

export default function App() {
  const { t } = useTranslation();
  const [langChosen, setLangChosen] = useState(hasChosenLanguage());
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!langChosen) return <LanguageSelect onDone={() => setLangChosen(true)} />;
  if (!isConfigured)
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <p className="max-w-sm text-muted">VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY → .env</p>
      </div>
    );
  if (!ready) return <div className="h-full grid place-items-center text-muted">{t('common.loading')}</div>;
  if (!session) return <AuthScreen />;
  return <AppLock><AppShell session={session} /></AppLock>;
}
