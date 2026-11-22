import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import tr from './locales/tr.json';
import de from './locales/de.json';

export const LANGS = [
  { code: 'tr', label: 'Türkçe', hello: 'Hoş Geldiniz' },
  { code: 'de', label: 'Deutsch', hello: 'Willkommen' },
  { code: 'en', label: 'English', hello: 'Welcome' },
] as const;
export type LangCode = (typeof LANGS)[number]['code'];

const KEY = 'kaytom.lang';
const isLang = (v: string | null): v is LangCode => !!v && LANGS.some((l) => l.code === v);

export const hasChosenLanguage = () => isLang(localStorage.getItem(KEY));

function detect(): LangCode {
  const saved = localStorage.getItem(KEY);
  if (isLang(saved)) return saved;
  const nav = navigator.language.slice(0, 2);
  return isLang(nav) ? nav : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr }, de: { translation: de } },
  lng: detect(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
document.documentElement.lang = i18n.language;

export async function setLanguage(code: LangCode) {
  localStorage.setItem(KEY, code);
  await i18n.changeLanguage(code);
  document.documentElement.lang = code;
}

export default i18n;
