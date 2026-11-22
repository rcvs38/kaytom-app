/* eslint-disable @typescript-eslint/no-explicit-any */
import { Capacitor } from '@capacitor/core';

const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
const native = Capacitor.isNativePlatform();
export const sttNative = native;
export const sttSupported = native || !!SR;

/** Web: Web Speech API. Android/iOS uygulaması: yerel konuşma tanıma eklentisi (WebView'de Web Speech yoktur). */
export function startRecognition(lang: string, onText: (t: string) => void, onEnd: () => void, onError: (e: string) => void) {
  if (native) {
    let handle: { remove: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') return onError('not-allowed');
        handle = await SpeechRecognition.addListener('partialResults', (d: { matches?: string[] }) => { if (d.matches?.[0]) onText(d.matches[0]); });
        await SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 });
      } catch (e) { onError(String(e)); }
    })();
    return { stop: () => { void import('@capacitor-community/speech-recognition').then(async ({ SpeechRecognition }) => { await SpeechRecognition.stop().catch(() => undefined); await handle?.remove(); onEnd(); }); } };
  }
  const r = new SR();
  r.lang = lang; r.interimResults = true; r.continuous = true;
  r.onresult = (e: any) => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; onText(s.trim()); };
  r.onend = onEnd; r.onerror = (e: any) => onError(String(e.error));
  r.start();
  return r as { stop: () => void };
}
