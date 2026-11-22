import { useTranslation } from 'react-i18next';
import { TR_LANGS } from '../lib/languages';
import type { Prefs } from '../lib/prefs';

interface Props { prefs: Prefs; set: (p: Partial<Prefs>) => void; onClose: () => void }

export default function TranslateMenu({ prefs, set, onClose }: Props) {
  const { t } = useTranslation();
  const sel = 'rounded-xl bg-bubbleIn px-3 py-2 outline-none w-full';
  const sw = (v: boolean, on: (b: boolean) => void, label: string) => (
    <label className="flex items-center justify-between gap-3"><span>{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="w-5 h-5 accent-[#00B4D8]" /></label>);
  const langSel = (v: string, on: (s: string) => void, label: string) => (
    <label className="grid gap-1"><span className="text-sm font-bold text-muted">{label}</span>
      <select value={v} onChange={(e) => on(e.target.value)} className={sel}>{TR_LANGS.map((l) => <option key={l[0]} value={l[0]}>{l[1]}</option>)}</select></label>);
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div role="dialog" className="absolute right-3 top-14 z-30 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-panel border border-line shadow-xl p-4 grid gap-4">
        <h3 className="font-extrabold">{t('translate.title')}</h3>
        {sw(prefs.autoTranslate, (b) => set({ autoTranslate: b }), t('translate.auto'))}
        {langSel(prefs.myLang, (s) => set({ myLang: s }), t('translate.myLang'))}
        {langSel(prefs.sendLang, (s) => set({ sendLang: s }), t('translate.sendLang'))}
        {sw(prefs.autoSpeak, (b) => set({ autoSpeak: b }), t('translate.autoSpeak'))}
        <div className="grid gap-1"><span className="text-sm font-bold text-muted">{t('translate.speed')}</span>
          <div className="flex gap-2" role="radiogroup">
            {(['slow', 'normal', 'fast'] as const).map((r) => (
              <button key={r} role="radio" aria-checked={prefs.rate === r} onClick={() => set({ rate: r })}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${prefs.rate === r ? 'bg-brand text-brand-ink' : 'bg-bubbleIn'}`}>{t(`translate.${r}`)}</button>))}
          </div></div>
      </div>
    </>
  );
}
