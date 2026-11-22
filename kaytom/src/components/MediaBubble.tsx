import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Printer } from 'lucide-react';
import type { Message } from '../types';
import { signedUrl } from '../lib/upload';
import { printFile } from '../lib/print';
import AudioBubble from './AudioBubble';

const size = (n: number | null) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function MediaBubble({ m }: { m: Message }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (m.media_path) void signedUrl(m.media_path).then(setUrl); }, [m.media_path]);

  const print = async () => {
    if (!url) return; setErr('');
    try { const b = await (await fetch(url)).blob(); await printFile(b, m.media_name ?? 'file'); } catch { setErr(t('chat.printFailed')); }
  };
  const btn = 'flex items-center gap-1 rounded-lg bg-brand-ink/10 hover:bg-brand-ink/20 px-2 py-1 text-xs font-semibold';

  if (m.kind === 'audio') return <AudioBubble url={url} seconds={m.duration_seconds} />;
  return (
    <div className="grid gap-1.5">
      {m.kind === 'image' && url && <img src={url} alt={m.media_name ?? ''} className="rounded-xl max-h-72 object-cover" />}
      {m.kind === 'video' && url && <video src={url} controls preload="metadata" className="rounded-xl max-h-72" />}
      {m.kind === 'file' && (
        <div className="flex items-center gap-2"><FileText size={28} /><div className="min-w-0"><div className="font-semibold truncate">{m.media_name}</div><div className="text-xs opacity-70">{size(m.media_size)}</div></div></div>
      )}
      <div className="flex gap-2 flex-wrap">
        {url && <a href={url} download={m.media_name ?? undefined} target="_blank" rel="noreferrer" className={btn}><Download size={14} />{t('chat.download')}</a>}
        {m.kind !== 'video' && <button onClick={print} className={btn}><Printer size={14} />{t('chat.print')}</button>}
      </div>
      {err && <span role="alert" className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
