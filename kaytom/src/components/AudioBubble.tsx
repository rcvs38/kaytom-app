import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function AudioBubble({ url, seconds }: { url: string | null; seconds: number | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = seconds ?? 0;

  useEffect(() => () => ref.current?.pause(), []);
  const toggle = () => { const a = ref.current; if (!a || !url) return; if (a.paused) void a.play(); else a.pause(); };

  return (
    <div className="flex items-center gap-2 min-w-[210px]">
      <button onClick={toggle} disabled={!url} aria-label={playing ? 'Pause' : 'Play'}
        className="w-9 h-9 rounded-full bg-brand-ink/15 grid place-items-center shrink-0 disabled:opacity-40">
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <input type="range" min={0} max={Math.max(total, 1)} step={0.1} value={pos} aria-label="Seek"
        onChange={(e) => { const v = Number(e.target.value); setPos(v); if (ref.current) ref.current.currentTime = v; }}
        className="flex-1 accent-[#04242C] h-1" />
      <span className="text-xs tabular-nums w-9 text-right">{fmt(playing || pos ? pos : total)}</span>
      {url && <audio ref={ref} src={url} preload="metadata"
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }} />}
    </div>
  );
}
