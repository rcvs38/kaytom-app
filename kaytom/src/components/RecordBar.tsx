import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Trash2 } from 'lucide-react';
import { Recorder, type RecResult } from '../lib/recorder';

interface Props { onSend: (r: RecResult) => void; onCancel: () => void; onDenied: () => void }

/** Canlı süre, ses dalgası, İptal / Gönder. */
export default function RecordBar({ onSend, onCancel, onDenied }: Props) {
  const { t } = useTranslation();
  const [secs, setSecs] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.05));
  const rec = useRef<Recorder | null>(null);
  const last = useRef(0);

  useEffect(() => {
    const r = new Recorder((v) => {
      const now = performance.now(); if (now - last.current < 70) return; last.current = now;
      setBars((b) => [...b.slice(1), Math.max(0.05, Math.min(1, v * 2.2))]);
    });
    rec.current = r;
    r.start().catch(onDenied);
    const iv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { clearInterval(iv); r.cancel(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => { const res = await rec.current?.stop(); if (res) onSend(res); else onCancel(); };
  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="flex items-center gap-3 p-3 bg-panel border-t border-line safe-bottom">
      <button onClick={onCancel} aria-label={t('chat.cancelRec')} className="flex items-center gap-1.5 text-red-500 font-semibold px-2 py-2"><Trash2 size={20} /><span className="hidden sm:inline">{t('chat.cancelRec')}</span></button>
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      <span className="tabular-nums font-semibold w-12">{mm}</span>
      <div className="flex-1 flex items-center gap-[3px] h-9" aria-hidden>
        {bars.map((b, i) => <span key={i} className="flex-1 rounded-full bg-brand" style={{ height: `${b * 100}%`, minHeight: 3 }} />)}
      </div>
      <button onClick={send} aria-label={t('chat.sendRec')} className="h-11 px-4 rounded-full bg-brand hover:bg-brand-hover text-brand-ink font-bold flex items-center gap-2"><Send size={18} />{t('chat.sendRec')}</button>
    </div>
  );
}
