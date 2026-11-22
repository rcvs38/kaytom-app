export function pickMime(): string {
  const c = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return c.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}
export const extOf = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

export interface RecResult { blob: Blob; mime: string; seconds: number }

export class Recorder {
  private rec!: MediaRecorder; private stream!: MediaStream; private chunks: Blob[] = [];
  private ctx?: AudioContext; private raf = 0; private t0 = 0; private cancelled = false;
  constructor(private onLevel: (v: number) => void) {}

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = pickMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250); this.t0 = Date.now();
    this.ctx = new AudioContext();
    const an = this.ctx.createAnalyser(); an.fftSize = 256;
    this.ctx.createMediaStreamSource(this.stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => { an.getByteTimeDomainData(buf); let m = 0; for (const b of buf) m = Math.max(m, Math.abs(b - 128)); this.onLevel(m / 128); this.raf = requestAnimationFrame(tick); };
    tick();
  }
  private cleanup() { cancelAnimationFrame(this.raf); this.stream?.getTracks().forEach((t) => t.stop()); void this.ctx?.close(); }
  stop(): Promise<RecResult | null> {
    return new Promise((resolve) => {
      if (!this.rec || this.rec.state === 'inactive') { this.cleanup(); return resolve(null); }
      this.rec.onstop = () => {
        this.cleanup();
        if (this.cancelled) return resolve(null);
        const mime = this.rec.mimeType || 'audio/webm';
        resolve({ blob: new Blob(this.chunks, { type: mime }), mime, seconds: Math.max(1, Math.round((Date.now() - this.t0) / 1000)) });
      };
      this.rec.stop();
    });
  }
  cancel() { this.cancelled = true; void this.stop(); }
}
