// [kod, yerel ad, TTS/STT BCP-47]
export const TR_LANGS: ReadonlyArray<readonly [string, string, string]> = [
  ['tr', 'Türkçe', 'tr-TR'], ['de', 'Deutsch', 'de-DE'], ['en', 'English', 'en-US'], ['ar', 'العربية', 'ar-SA'],
  ['ru', 'Русский', 'ru-RU'], ['fr', 'Français', 'fr-FR'], ['es', 'Español', 'es-ES'], ['it', 'Italiano', 'it-IT'],
  ['nl', 'Nederlands', 'nl-NL'], ['pl', 'Polski', 'pl-PL'], ['ro', 'Română', 'ro-RO'], ['uk', 'Українська', 'uk-UA'],
  ['pt', 'Português', 'pt-PT'], ['el', 'Ελληνικά', 'el-GR'], ['bg', 'Български', 'bg-BG'], ['cs', 'Čeština', 'cs-CZ'],
  ['sv', 'Svenska', 'sv-SE'], ['hu', 'Magyar', 'hu-HU'], ['da', 'Dansk', 'da-DK'], ['fi', 'Suomi', 'fi-FI'],
  ['no', 'Norsk', 'nb-NO'], ['hr', 'Hrvatski', 'hr-HR'], ['sr', 'Српски', 'sr-RS'], ['sq', 'Shqip', 'sq-AL'],
  ['fa', 'فارسی', 'fa-IR'], ['he', 'עברית', 'he-IL'], ['hi', 'हिन्दी', 'hi-IN'], ['zh', '中文', 'zh-CN'],
  ['ja', '日本語', 'ja-JP'], ['ko', '한국어', 'ko-KR'], ['id', 'Bahasa Indonesia', 'id-ID'],
];
export const bcp = (code: string) => TR_LANGS.find((l) => l[0] === code)?.[2] ?? code;
const MM: Record<string, string> = { zh: 'zh-CN', no: 'nb' };
export const mmCode = (code: string) => MM[code] ?? code;
