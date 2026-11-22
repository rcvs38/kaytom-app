import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ChevronLeft, ChevronRight, Contrast, Image as ImageIcon, Printer, RotateCw, Save, Send, Trash2, X } from 'lucide-react';
import { buildPdf, type ScanPage } from '../lib/pdf';
import { printFile } from '../lib/print';

interface Props { onClose: () => void; onSend: (pdf: File) => Promise<void> }

export default function ScanDialog({ onClose, onSend }: Props) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [name, setName] = useState(`scan-${new Date().toISOString().slice(0, 10)}`);
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null);

  const add = (files: FileList | null) => {
    if (!files) return;
    const np: ScanPage[] = [...files].map((f) => ({ id: crypto.randomUUID(), src: URL.createObjectURL(f), rot: 0, bw: false }));
    setPages((p) => [...p, ...np]);
  };
  const patch = (id: string, f: (p: ScanPage) => ScanPage) => setPages((ps) => ps.map((p) => (p.id === id ? f(p) : p)));
  const move = (i: number, d: number) => setPages((ps) => { const n = [...ps]; const j = i + d; if (j < 0 || j >= n.length) return ps; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const fname = `${name.trim().replace(/[^\w\-. ]+/g, '_') || 'scan'}.pdf`;

  const run = async (kind: 'send' | 'print' | 'save') => {
    if (!pages.length) return; setBusy(true);
    try {
      const blob = await buildPdf(pages);
      if (kind === 'send') { await onSend(new File([blob], fname, { type: 'application/pdf' })); onClose(); }
      else if (kind === 'print') await printFile(blob, fname);
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    } finally { setBusy(false); }
  };

  const ib = 'w-8 h-8 grid place-items-center rounded-lg bg-black/55 text-white hover:bg-black/75';
  const pb = 'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 font-bold disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-0 sm:p-4">
      <div role="dialog" aria-modal className="w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col bg-panel sm:rounded-2xl border border-line safe-top safe-bottom">
        <header className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="font-extrabold text-lg">{t('scan.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')}><X /></button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin p-4 grid gap-4 content-start">
          <div className="flex gap-2">
            <button onClick={() => cam.current?.click()} className={`${pb} bg-brand text-brand-ink hover:bg-brand-hover`}><Camera size={18} />{t('scan.addPage')}</button>
            <button onClick={() => gal.current?.click()} className={`${pb} bg-bubbleIn`}><ImageIcon size={18} />{t('scan.gallery')}</button>
            <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </div>
          {pages.length === 0 && <p className="text-center text-muted py-10">{t('scan.empty')}</p>}
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pages.map((p, i) => (
              <li key={p.id} className="relative rounded-xl border border-line bg-bubbleIn aspect-[3/4] overflow-hidden grid place-items-center">
                <img src={p.src} alt="" className="max-w-full max-h-full transition-transform"
                  style={{ transform: `rotate(${p.rot}deg) scale(${p.rot % 180 ? 0.72 : 1})`, filter: p.bw ? 'grayscale(1) contrast(1.6) brightness(1.1)' : 'none' }} />
                <span className="absolute left-1.5 top-1.5 text-xs font-bold bg-black/55 text-white rounded px-1.5">{i + 1}</span>
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                  <button className={ib} aria-label={t('scan.moveLeft')} onClick={() => move(i, -1)}><ChevronLeft size={16} /></button>
                  <button className={ib} aria-label={t('scan.rotate')} onClick={() => patch(p.id, (x) => ({ ...x, rot: ((x.rot + 90) % 360) as ScanPage['rot'] }))}><RotateCw size={16} /></button>
                  <button className={ib} aria-label={p.bw ? t('scan.color') : t('scan.bw')} onClick={() => patch(p.id, (x) => ({ ...x, bw: !x.bw }))}><Contrast size={16} /></button>
                  <button className={ib} aria-label={t('scan.remove')} onClick={() => setPages((ps) => ps.filter((x) => x.id !== p.id))}><Trash2 size={16} /></button>
                  <button className={ib} aria-label={t('scan.moveRight')} onClick={() => move(i, 1)}><ChevronRight size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <footer className="p-4 border-t border-line grid gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('scan.fileName')} placeholder={t('scan.fileName')} className="rounded-xl bg-bubbleIn px-4 py-2.5 outline-none" />
          <div className="grid grid-cols-3 gap-2">
            <button disabled={busy || !pages.length} onClick={() => run('send')} className={`${pb} bg-brand text-brand-ink hover:bg-brand-hover`}><Send size={16} />{t('scan.send')}</button>
            <button disabled={busy || !pages.length} onClick={() => run('print')} className={`${pb} bg-bubbleIn`}><Printer size={16} />{t('scan.print')}</button>
            <button disabled={busy || !pages.length} onClick={() => run('save')} className={`${pb} bg-bubbleIn`}><Save size={16} />{t('scan.save')}</button>
          </div>
          {busy && <p className="text-sm text-muted text-center">{t('scan.working')}</p>}
        </footer>
      </div>
    </div>
  );
}
