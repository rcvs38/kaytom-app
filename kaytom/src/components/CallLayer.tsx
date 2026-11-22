import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useCall } from '../lib/callContext';
import { startRing, stopRing } from '../lib/ringtone';
import { showSystemNotification } from '../lib/notify';
import type { Conversation } from '../types';
import Avatar from './Avatar';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function CallLayer({ convs }: { convs: Conversation[] }) {
  const { t } = useTranslation();
  const { mgr, state } = useCall();
  const peer = convs.flatMap((c) => c.members).find((m) => m.user_id === state.peerId)?.profile;
  const name = peer?.display_name ?? 'KAYTOM';
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state.phase === 'incoming') {
      startRing('ring');
      if (document.visibilityState !== 'visible') showSystemNotification(name, t(state.kind === 'video' ? 'call.incomingVideo' : 'call.incomingVoice'));
    } else if (state.phase === 'outgoing' && state.delivered) startRing('ringback');
    else stopRing();
    return () => stopRing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.delivered]);

  useEffect(() => { if (state.phase !== 'active') return; const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, [state.phase]);
  useEffect(() => { const v = remoteRef.current; if (v) { v.srcObject = state.remote; v.muted = false; v.volume = 1; void v.play().catch(() => undefined); } }, [state.remote, state.phase]);
  useEffect(() => { const v = localRef.current; if (v) v.srcObject = state.local; }, [state.local, state.phase, state.camOff]);

  if (state.phase === 'idle')
    return state.notice ? <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] rounded-full bg-black/80 text-white px-4 py-2 text-sm">{t(`call.${state.notice}`)}</div> : null;

  const video = state.kind === 'video';
  const secs = state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0;
  const status = state.phase === 'incoming' ? t(video ? 'call.incomingVideo' : 'call.incomingVoice')
    : state.phase === 'outgoing' ? t(state.delivered ? 'call.ringing' : 'call.calling')
    : state.phase === 'connecting' ? t('call.connecting') : mmss(secs);
  const round = 'w-14 h-14 rounded-full grid place-items-center';
  const showVideo = video && (state.phase === 'active' || state.phase === 'connecting');

  return (
    <div role="dialog" aria-modal aria-label={status} className="fixed inset-0 z-[60] bg-[#0A1317] text-white flex flex-col safe-top safe-bottom">
      <video ref={remoteRef} autoPlay playsInline className={showVideo ? 'absolute inset-0 w-full h-full object-cover' : 'absolute w-0 h-0 opacity-0'} />
      {showVideo && state.local && !state.camOff && <video ref={localRef} autoPlay playsInline muted className="absolute right-3 top-16 w-28 h-40 rounded-xl object-cover border border-white/30 [transform:scaleX(-1)]" />}
      <div className={`relative z-10 flex-1 flex flex-col items-center ${showVideo ? 'justify-start pt-6' : 'justify-center'} gap-3 text-center px-6`}>
        {!showVideo && <Avatar name={name} url={peer?.avatar_url} size={112} />}
        <h1 className="text-2xl font-extrabold drop-shadow">{name}</h1>
        <p className="text-white/80 tabular-nums drop-shadow">{status}</p>
      </div>
      <div className="relative z-10 flex items-center justify-center gap-6 pb-10 pt-4">
        {state.phase === 'incoming' ? (<>
          <button onClick={() => void mgr?.decline()} aria-label={t('call.decline')} className={`${round} bg-red-500`}><PhoneOff /></button>
          <button onClick={() => void mgr?.accept()} aria-label={t('call.accept')} className={`${round} bg-brand text-brand-ink animate-pulse`}>{video ? <Video /> : <Phone />}</button>
        </>) : (<>
          {state.phase !== 'outgoing' && <button onClick={() => mgr?.toggleMute()} aria-label={t(state.muted ? 'call.unmute' : 'call.mute')} className={`${round} ${state.muted ? 'bg-white text-black' : 'bg-white/20'}`}>{state.muted ? <MicOff /> : <Mic />}</button>}
          {video && state.phase !== 'outgoing' && <button onClick={() => mgr?.toggleCam()} aria-label={t(state.camOff ? 'call.camOn' : 'call.camOff')} className={`${round} ${state.camOff ? 'bg-white text-black' : 'bg-white/20'}`}>{state.camOff ? <VideoOff /> : <Video />}</button>}
          <button onClick={() => void mgr?.hangup()} aria-label={t(state.phase === 'outgoing' ? 'call.cancel' : 'call.hangup')} className={`${round} bg-red-500`}><PhoneOff /></button>
        </>)}
      </div>
    </div>
  );
}
