import { Capacitor } from '@capacitor/core';

const native = Capacitor.isNativePlatform();
export const ttsSupported = native || (typeof window !== 'undefined' && 'speechSynthesis' in window);

export function speak(text: string, lang: string, rate: number, onEnd: () => void) {
  if (native) {
    void import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) =>
      TextToSpeech.speak({ text, lang, rate, pitch: 1, volume: 1 }).then(onEnd, onEnd));
    return;
  }
  if (!ttsSupported) return onEnd();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = rate;
  const v = speechSynthesis.getVoices();
  const voice = v.find((x) => x.lang === lang) ?? v.find((x) => x.lang.startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.onend = onEnd; u.onerror = onEnd;
  speechSynthesis.speak(u);
}
export const stopSpeaking = () => {
  if (native) void import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => TextToSpeech.stop().catch(() => undefined));
  else if (ttsSupported) speechSynthesis.cancel();
};
