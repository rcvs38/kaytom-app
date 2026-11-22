import { supabase } from './supabase';

export type CallKind = 'audio' | 'video';
export interface CallState {
  phase: 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';
  callId: string | null; kind: CallKind; peerId: string | null;
  delivered: boolean; muted: boolean; camOff: boolean;
  local: MediaStream | null; remote: MediaStream | null; startedAt: number | null; notice: string | null;
}
interface CallRow { id: string; caller_id: string; callee_id: string; kind: CallKind; status: string; created_at: string }
interface SignalRow { id: number; call_id: string; from_id: string; to_id: string; type: 'offer' | 'answer' | 'ice'; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }

const IDLE: CallState = { phase: 'idle', callId: null, kind: 'audio', peerId: null, delivered: false, muted: false, camOff: false, local: null, remote: null, startedAt: null, notice: null };

const env = import.meta.env as Record<string, string | undefined>;

function parseIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  // 1) .env: VITE_ICE_SERVERS = JSON dizisi, ör. [{"urls":"turn:host:3478","username":"u","credential":"p"}]
  try { const j = JSON.parse(env.VITE_ICE_SERVERS ?? '[]'); if (Array.isArray(j)) servers.push(...(j as RTCIceServer[])); } catch { /* geçersiz JSON yok sayılır */ }
  // 2) .env: VITE_TURN_URL (virgülle birden fazla), VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL
  const urls = (env.VITE_TURN_URL ?? '').split(',').map((u) => u.trim()).filter(Boolean);
  if (urls.length) servers.push({ urls, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL });
  // 3) Hiç TURN tanımlı değilse: herkese açık yedek röle (doğrulanmadı; kapanmış/sınırlı olabilir). Medya uçtan uca şifreli (DTLS-SRTP) kalır.
  if (servers.length === 1 && env.VITE_DISABLE_FALLBACK_TURN !== '1')
    servers.push({ urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' });
  return servers;
}
const ICE: RTCConfiguration = { iceServers: parseIceServers(), iceCandidatePoolSize: 4 };
export const callsSupported = () => typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export class CallManager {
  private state: CallState = { ...IDLE };
  private listeners = new Set<() => void>();
  private pc: RTCPeerConnection | null = null;
  private ch: ReturnType<typeof supabase.channel> | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private buffered = new Map<string, SignalRow[]>();
  private queue: Promise<void> = Promise.resolve();
  private ringTimer?: number; private noticeTimer?: number; private ackTimer?: number;
  private early: CallRow[] = [];

  constructor(private me: string) {}
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getState = () => this.state;
  private set(p: Partial<CallState>) { this.state = { ...this.state, ...p }; this.listeners.forEach((l) => l()); }

  start() {
    const me = this.me;
    this.ch = supabase.channel('calls:' + me)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${me}` }, (p) => this.onIncoming(p.new as CallRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${me}` }, (p) => this.onUpdate(p.new as CallRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${me}` }, (p) => this.onUpdate(p.new as CallRow))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `to_id=eq.${me}` }, (p) => this.onSignal(p.new as SignalRow))
      .subscribe();
  }
  destroy() { this.teardown(null); if (this.ch) { void supabase.removeChannel(this.ch); this.ch = null; } }

  private teardown(notice: string | null) {
    clearTimeout(this.ringTimer); clearTimeout(this.ackTimer); this.early = [];
    this.state.local?.getTracks().forEach((t) => t.stop());
    this.pc?.close(); this.pc = null; this.pendingIce = []; this.buffered.clear();
    this.set({ ...IDLE, notice });
    clearTimeout(this.noticeTimer);
    if (notice) this.noticeTimer = window.setTimeout(() => this.set({ notice: null }), 3500);
  }

  private async getMedia(kind: CallKind): Promise<MediaStream | null> {
    if (!callsSupported()) { this.set({ notice: 'unavailable' }); return null; }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch { this.teardown('mediaDenied'); return null; }
  }

  private makePc(stream: MediaStream, peerId: string, callId: string) {
    const pc = new RTCPeerConnection(ICE); this.pc = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const remote = new MediaStream();
    pc.ontrack = (e) => { e.streams[0]?.getTracks().forEach((t) => { if (!remote.getTracks().includes(t)) remote.addTrack(t); }); this.set({ remote }); };
    pc.onicecandidate = (e) => { if (e.candidate) void this.signal(callId, peerId, 'ice', e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && this.state.phase !== 'active') { clearTimeout(this.ringTimer); this.set({ phase: 'active', startedAt: Date.now() }); }
      else if (pc.connectionState === 'failed') void this.finish('ended', 'failed');
    };
  }

  private async signal(callId: string, to: string, type: SignalRow['type'], payload: unknown) {
    await supabase.from('call_signals').insert({ call_id: callId, from_id: this.me, to_id: to, type, payload });
  }

  /** Arama başlat */
  async call(peerId: string, kind: CallKind) {
    if (this.state.phase !== 'idle') return;
    clearTimeout(this.noticeTimer); this.set({ notice: null });
    const stream = await this.getMedia(kind); if (!stream) return;
    this.set({ phase: 'outgoing', kind, peerId, local: stream, delivered: false });
    const { data, error } = await supabase.rpc('start_call', { callee: peerId, call_kind: kind });
    if (error || !data) return this.teardown('failed');
    const callId = data as string;
    this.set({ callId }); this.makePc(stream, peerId, callId);
    // CALL_RINGING onayı 15 sn içinde gelmezse karşı taraf ulaşılamıyor / çevrimdışı
    this.ackTimer = window.setTimeout(() => {
      if (this.state.callId === callId && this.state.phase === 'outgoing' && !this.state.delivered) { void supabase.rpc('end_call', { cid: callId, new_status: 'missed' }); this.teardown('unreachable'); }
    }, 15_000);
    for (const r of this.early.splice(0)) this.onUpdate(r);
    this.ringTimer = window.setTimeout(() => {
      if (this.state.callId === callId && this.state.phase === 'outgoing') { void supabase.rpc('end_call', { cid: callId, new_status: 'missed' }); this.teardown('noAnswer'); }
    }, 45_000);
  }

  private onIncoming(row: CallRow) {
    if (Date.now() - new Date(row.created_at).getTime() > 60_000) return;
    if (this.state.phase !== 'idle') { void supabase.rpc('end_call', { cid: row.id, new_status: 'declined' }); return; }
    this.set({ phase: 'incoming', callId: row.id, kind: row.kind, peerId: row.caller_id, delivered: true, notice: null });
    void supabase.rpc('call_ringing', { cid: row.id });
    this.ringTimer = window.setTimeout(() => { if (this.state.callId === row.id && this.state.phase === 'incoming') this.teardown('missed'); }, 50_000);
  }

  private onUpdate(row: CallRow) {
    if (this.state.phase === 'outgoing' && !this.state.callId) { this.early.push(row); return; }
    if (row.id !== this.state.callId) return;
    const s = this.state;
    switch (row.status) {
      case 'ringing': if (s.phase === 'outgoing') { clearTimeout(this.ackTimer); this.set({ delivered: true }); } break;
      case 'accepted': if (s.phase === 'outgoing') { clearTimeout(this.ringTimer); clearTimeout(this.ackTimer); this.set({ phase: 'connecting' }); void this.sendOffer(); } break;
      case 'declined': this.teardown('declined'); break;
      case 'cancelled': case 'missed': this.teardown(s.phase === 'incoming' ? 'missed' : 'noAnswer'); break;
      case 'ended': this.teardown('ended'); break;
    }
  }

  private async sendOffer() {
    const pc = this.pc, s = this.state; if (!pc || !s.callId || !s.peerId) return;
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await this.signal(s.callId, s.peerId, 'offer', pc.localDescription?.toJSON());
  }

  private onSignal(sig: SignalRow) {
    if (sig.call_id !== this.state.callId || !this.pc) { this.buffered.set(sig.call_id, [...(this.buffered.get(sig.call_id) ?? []), sig]); return; }
    this.queue = this.queue.then(() => this.handle(sig)).catch(() => undefined);
  }

  private async flushIce() { const pc = this.pc; if (!pc) return; for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined); }

  private async handle(sig: SignalRow) {
    const pc = this.pc; if (!pc) return;
    if (sig.type === 'offer') {
      await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit); await this.flushIce();
      const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
      await this.signal(sig.call_id, sig.from_id, 'answer', pc.localDescription?.toJSON());
    } else if (sig.type === 'answer') {
      await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit); await this.flushIce();
    } else if (pc.remoteDescription) await pc.addIceCandidate(sig.payload as RTCIceCandidateInit).catch(() => undefined);
    else this.pendingIce.push(sig.payload as RTCIceCandidateInit);
  }

  /** Gelen aramayı kabul et */
  async accept() {
    const s = this.state; if (s.phase !== 'incoming' || !s.callId || !s.peerId) return;
    clearTimeout(this.ringTimer);
    const stream = await this.getMedia(s.kind);
    if (!stream) { await supabase.rpc('end_call', { cid: s.callId, new_status: 'declined' }); return; }
    this.set({ phase: 'connecting', local: stream });
    this.makePc(stream, s.peerId, s.callId);
    for (const sig of this.buffered.get(s.callId) ?? []) this.queue = this.queue.then(() => this.handle(sig)).catch(() => undefined);
    this.buffered.delete(s.callId);
    const { error } = await supabase.rpc('answer_call', { cid: s.callId });
    if (error) this.teardown('failed');
  }

  async decline() { const id = this.state.callId; this.teardown(null); if (id) await supabase.rpc('end_call', { cid: id, new_status: 'declined' }); }
  async hangup() { await this.finish(this.state.phase === 'outgoing' ? 'cancelled' : 'ended', null); }
  private async finish(status: 'cancelled' | 'ended', notice: string | null) {
    const id = this.state.callId; if (this.state.phase === 'idle') return;
    this.teardown(notice); if (id) await supabase.rpc('end_call', { cid: id, new_status: status });
  }

  toggleMute() { const m = !this.state.muted; this.state.local?.getAudioTracks().forEach((t) => (t.enabled = !m)); this.set({ muted: m }); }
  toggleCam() { const off = !this.state.camOff; this.state.local?.getVideoTracks().forEach((t) => (t.enabled = !off)); this.set({ camOff: off }); }
}
