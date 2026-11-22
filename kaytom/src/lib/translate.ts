import { mmCode } from './languages';

export interface Translation { text: string; from: string | null; same: boolean }
const cache = new Map<string, Translation>();

const decode = (s: string) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

function chunks(text: string, max = 450): string[] {
  const parts = text.split(/(?<=[.!?\n])\s+/); const out: string[] = []; let cur = '';
  for (const p of parts) {
    if ((cur + ' ' + p).length > max && cur) { out.push(cur); cur = ''; }
    let rest = p; while (rest.length > max) { out.push(rest.slice(0, max)); rest = rest.slice(max); }
    cur = cur ? cur + ' ' + rest : rest;
  }
  if (cur) out.push(cur);
  return out;
}

/** Ücretsiz MyMemory API (anahtar gerekmez). Ağ/limit hatasında null döner, uygulama çökmez. */
export async function translateText(text: string, to: string, from = 'autodetect'): Promise<Translation | null> {
  const key = `${from}|${to}|${text}`;
  const hit = cache.get(key); if (hit) return hit;
  try {
    let detected: string | null = null; const out: string[] = [];
    for (const c of chunks(text)) {
      const ctrl = new AbortController(); const to_ = setTimeout(() => ctrl.abort(), 8000);
      const pair = `${from === 'autodetect' ? 'Autodetect' : mmCode(from)}|${mmCode(to)}`;
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=${encodeURIComponent(pair)}`, { signal: ctrl.signal });
      clearTimeout(to_);
      if (!r.ok) return null;
      const j = await r.json();
      if (Number(j.responseStatus) !== 200 || !j.responseData?.translatedText) return null;
      out.push(decode(j.responseData.translatedText));
      detected ??= j.responseData.detectedLanguage ? String(j.responseData.detectedLanguage).slice(0, 2).toLowerCase() : null;
    }
    const res: Translation = { text: out.join(' '), from: detected, same: detected === to || out.join(' ').trim() === text.trim() };
    cache.set(key, res); return res;
  } catch { return null; }
}
