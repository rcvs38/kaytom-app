let ctx: AudioContext | null = null;
let timer: number | undefined;

function tone(freq: number, at: number, dur: number, vol: number) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + dur + 0.02);
}

/** 'ring' = gelen arama zili (titreşimli), 'ringback' = arayan tarafın "çalıyor" sesi */
export function startRing(kind: 'ring' | 'ringback') {
  stopRing();
  try { ctx = ctx ?? new AudioContext(); void ctx.resume(); } catch { return; }
  const play = () => {
    if (!ctx) return; const t = ctx.currentTime;
    if (kind === 'ring') { tone(880, t, 0.35, 0.2); tone(660, t + 0.42, 0.35, 0.2); navigator.vibrate?.([300, 150, 300]); }
    else tone(425, t, 1.0, 0.1);
  };
  play(); timer = window.setInterval(play, kind === 'ring' ? 2200 : 4000);
}
export function stopRing() { if (timer !== undefined) { clearInterval(timer); timer = undefined; } navigator.vibrate?.(0); }
