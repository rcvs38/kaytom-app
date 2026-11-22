import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, X } from 'lucide-react';
import { startRecognition, sttNative, sttSupported } from '../lib/stt';
import { Recorder, type RecResult } from '../lib/recorder';
import { translateText } from '../lib/translate';
import { bcp } from '../lib/languages';

interface Props { myLang: string; sendLang: string; onClose: () => void;
  onSendText: (text: string) => Promise<void>; onSendVoice: (rec: RecResult, text: string) => Promise<void> }

export default function DictateDialog({ myLang, sendLang, onClose, onSendText, onSendVoice }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'listening' | 'done'>('idle');
  const [heard, setHeard] = useState('');
  const [out, setOut] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef<Recorder | null>(null), srRef = useRef<{ stop: () => void } | null>(null);
  const audio = useRef<RecResult | null>(null);
  const heardRef = useRef('');

  const finish = async () => {
    srRef.current?.stop();
    audio.current = (await recRef.current?.stop()) ?? null;
    setState('done');
    const text = heardRef.current.trim();
    if (!text) return;
    const tr = sendLang === myLang ? null : await translateText(text, sendLang, myLang);
    setOut(tr ? tr.text : text);
    if (!tr && sendLang !== myLang) setError(t('chat.translateFailed'));
  };

  const start = async () => {
    setError('');
    if (!sttSupported) return setError(t('chat.dictateUnsupported'));
    try {
      if (!sttNative) { const r = new Recorder(() => {}); await r.start(); recRef.current = r; }
      srRef.current = startRecognition(bcp(myLang), (s) => { heardRef.current = s; setHeard(s); }, () => { /* tarayıcı oturumu kapattı */ },
        (e) => { if (e === 'not-allowed' || e === 'service-not-allowed') setError(t('chat.micDenied')); });
      setState('listening');
    } catch { setError(t('chat.micDenied')); }
  };

  useEffect(() => () => { srRef.current?.stop(); recRef.current?.cancel(); }, []);
  const send = async (withVoice: boolean) => {
    const text = out.trim(); if (!text) return;
    if (withVoice && audio.current) await onSendVoice(audio.current, text); else await onSendText(text);
    onClose();
  };

  const lbl = 'text-sm font-bold text-muted';
  return (
    <div className="fixed inset-0 z-40 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal className="w-full max-w-md rounded-2xl bg-panel border border-line p-5 grid gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-extrabold text-lg">{t('chat.dictate')}</h2><button onClick={onClose} aria-label={t('common.close')}><X /></button></div>
        {state !== 'done' && (
          <button onClick={state === 'idle' ? start : finish}
            className={`mx-auto w-20 h-20 rounded-full grid place-items-center text-brand-ink ${state === 'listening' ? 'bg-red-400 animate-pulse' : 'bg-brand hover:bg-brand-hover'}`}
            aria-label={state === 'idle' ? t('chat.start') : t('chat.stop')}>{state === 'idle' ? <Mic size={30} /> : <Square size={26} />}</button>
        )}
        {state === 'listening' && <p className="text-center text-muted">{t('chat.dictating')}</p>}
        {(heard || state === 'done') && (<div className="grid gap-1"><span className={lbl}>{t('chat.transcript')}</span><p className="rounded-xl bg-bubbleIn p-3 min-h-[3rem]">{heard}</p></div>)}
        {state === 'done' && (<div className="grid gap-1"><span className={lbl}>{t('chat.translatedText')}</span>
          <textarea value={out} onChange={(e) => setOut(e.target.value)} rows={3} className="rounded-xl bg-bubbleIn p-3 outline-none resize-none" /></div>)}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        {state === 'done' && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => send(false)} disabled={!out.trim()} className="rounded-xl bg-brand hover:bg-brand-hover text-brand-ink font-bold py-2.5 disabled:opacity-40">{t('chat.sendText')}</button>
            <button onClick={() => send(true)} disabled={!out.trim() || !audio.current} className="rounded-xl bg-bubbleIn font-bold py-2.5 disabled:opacity-40">{t('chat.sendVoiceText')}</button>
          </div>)}
      </div>
    </div>
  );
}
