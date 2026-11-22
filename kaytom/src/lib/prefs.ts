import { useCallback, useState } from 'react';
import i18n from '../i18n';

export interface Prefs { autoTranslate: boolean; myLang: string; sendLang: string; autoSpeak: boolean; rate: 'slow' | 'normal' | 'fast' }
const KEY = 'kaytom.chatPrefs';

function load(): Prefs {
  const base: Prefs = { autoTranslate: false, myLang: i18n.language.slice(0, 2), sendLang: 'en', autoSpeak: false, rate: 'normal' };
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return base; }
}

export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const update = useCallback((p: Partial<Prefs>) => {
    setPrefs((cur) => { const n = { ...cur, ...p }; localStorage.setItem(KEY, JSON.stringify(n)); return n; });
  }, []);
  return [prefs, update];
}
export const RATE = { slow: 0.75, normal: 1, fast: 1.35 } as const;
