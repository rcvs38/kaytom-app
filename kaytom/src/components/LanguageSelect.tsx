import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { LANGS, setLanguage, type LangCode } from '../i18n';

export default function LanguageSelect({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const [sel, setSel] = useState<LangCode>(i18n.language.slice(0, 2) as LangCode);

  const pick = (c: LangCode) => { setSel(c); void i18n.changeLanguage(c); };
  const go = async () => { await setLanguage(sel); onDone(); };

  return (
    <main className="h-full overflow-auto grid place-items-center p-6 safe-top safe-bottom">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-brand grid place-items-center text-brand-ink font-extrabold text-2xl">K</div>
          <span className="text-2xl font-extrabold tracking-tight">{t('app.name')}</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">{LANGS.find((l) => l.code === sel)?.hello}</h1>
        <p className="mt-3 text-muted">{t('lang.subtitle')}</p>
        <div role="radiogroup" className="mt-8 grid gap-3">
          {LANGS.map((l) => (
            <button key={l.code} role="radio" aria-checked={sel === l.code} onClick={() => pick(l.code)}
              className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left transition-colors bg-panel ${
                sel === l.code ? 'border-brand' : 'border-line hover:border-brand-soft'}`}>
              <span><span className="block font-bold text-lg">{l.label}</span><span className="text-sm text-muted">{l.hello}</span></span>
              {sel === l.code && <Check className="text-brand" />}
            </button>
          ))}
        </div>
        <button onClick={go} className="mt-8 w-full rounded-2xl bg-brand hover:bg-brand-hover text-brand-ink font-bold py-4 transition-colors">
          {t('lang.continue')}
        </button>
      </div>
    </main>
  );
}
