import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Camera, Check, CheckCheck, Globe, Mic, MessageSquareText, Paperclip, Phone, Search, Send, Square, Video, Volume2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { avatarOf, formatLastSeen, formatTime, peerOf, tickOf, titleOf } from '../lib/chat';
import { bcp } from '../lib/languages';
import { RATE, usePrefs } from '../lib/prefs';
import { translateText, type Translation } from '../lib/translate';
import { speak, stopSpeaking, ttsSupported } from '../lib/tts';
import { extOf, type RecResult } from '../lib/recorder';
import { sendMedia, TooBigError, MAX_MB } from '../lib/upload';
import type { Conversation, Message } from '../types';
import Avatar from './Avatar';
import MediaBubble from './MediaBubble';
import RecordBar from './RecordBar';
import ScanDialog from './ScanDialog';
import DictateDialog from './DictateDialog';
import TranslateMenu from './TranslateMenu';
import { useCall } from '../lib/callContext';

interface Props { conv: Conversation; me: string; online: Set<string>; onBack: () => void }
const SEL = '*, receipts:message_receipts(user_id, delivered_at, read_at)';

export default function ChatView({ conv, me, online, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = usePrefs();
  const { mgr: callMgr, state: callState } = useCall();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [scan, setScan] = useState(false);
  const [dictate, setDictate] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trans, setTrans] = useState<Record<string, Translation | 'fail'>>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyping = useRef(0);
  const requested = useRef(new Set<string>());
  const pendingSpeak = useRef(new Set<string>());
  const prefsRef = useRef(prefs); prefsRef.current = prefs;

  const names = useMemo(() => Object.fromEntries(conv.members.map((m) => [m.user_id, m.profile.display_name])), [conv]);
  const peer = peerOf(conv, me);
  const markRead = useCallback(() => { if (document.visibilityState === 'visible') void supabase.rpc('mark_read', { cid: conv.id }); }, [conv.id]);

  useEffect(() => {
    let alive = true;
    supabase.from('messages').select(SEL).eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(300)
      .then(({ data }) => { if (alive) { setMessages((data ?? []) as Message[]); markRead(); } });
    const ch = supabase.channel('conv:' + conv.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` }, async (p) => {
        const { data } = await supabase.from('messages').select(SEL).eq('id', (p.new as Message).id).single();
        const m = (data ?? p.new) as Message;
        setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
        if (m.sender_id !== me) { markRead(); if (prefsRef.current.autoSpeak && m.body) pendingSpeak.current.add(m.id); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_receipts' }, (p) => {
        const r = p.new as { message_id: string; user_id: string; delivered_at: string | null; read_at: string | null };
        setMessages((ms) => ms.map((m) => (m.id !== r.message_id ? m : { ...m, receipts: (m.receipts ?? []).map((x) => (x.user_id === r.user_id ? { ...x, delivered_at: r.delivered_at, read_at: r.read_at } : x)) })));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => { const uid = payload.user_id as string; if (uid !== me) setTyping((s) => ({ ...s, [uid]: Date.now() })); })
      .subscribe();
    chRef.current = ch;
    const vis = () => markRead(); document.addEventListener('visibilitychange', vis);
    return () => { alive = false; stopSpeaking(); document.removeEventListener('visibilitychange', vis); void supabase.removeChannel(ch); };
  }, [conv.id, me, markRead]);

  useEffect(() => {
    const iv = setInterval(() => setTyping((s) => { const now = Date.now(); const n = Object.fromEntries(Object.entries(s).filter(([, ts]: [string, number]) => now - ts < 3000)); return Object.keys(n).length === Object.keys(s).length ? s : n; }), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, typing]);

  // Hedef dil değişince çevirileri sıfırla
  useEffect(() => { requested.current.clear(); setTrans({}); }, [prefs.myLang]);

  // Otomatik çeviri (gelen mesajlar)
  useEffect(() => {
    if (!prefs.autoTranslate) return;
    for (const m of messages) {
      if (m.sender_id === me || !m.body || requested.current.has(m.id)) continue;
      requested.current.add(m.id);
      void translateText(m.body, prefs.myLang).then((r) => setTrans((s) => ({ ...s, [m.id]: r ?? 'fail' })));
    }
  }, [messages, prefs.autoTranslate, prefs.myLang, me]);

  const speakMsg = useCallback((m: Message) => {
    const tr = trans[m.id];
    const useTr = prefs.autoTranslate && tr && tr !== 'fail' && !tr.same;
    const body = useTr ? tr.text : m.body ?? '';
    const lang = useTr ? bcp(prefs.myLang) : bcp(tr && tr !== 'fail' && tr.from ? tr.from : i18n.language.slice(0, 2));
    setSpeakingId(m.id);
    speak(body, lang, RATE[prefs.rate], () => setSpeakingId((c) => (c === m.id ? null : c)));
  }, [trans, prefs, i18n.language]);

  // Gelen mesajı otomatik sesli oku (çeviri hazır olunca)
  useEffect(() => {
    for (const id of [...pendingSpeak.current]) {
      const m = messages.find((x) => x.id === id); if (!m) continue;
      if (prefs.autoTranslate && !(id in trans)) continue;
      pendingSpeak.current.delete(id); speakMsg(m);
    }
  }, [messages, trans, prefs.autoTranslate, speakMsg]);

  const toggleSpeak = (m: Message) => { if (speakingId === m.id) { stopSpeaking(); setSpeakingId(null); } else speakMsg(m); };

  const push = (m: Message) => setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 1500) { lastTyping.current = Date.now(); void chRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: me } }); }
  };

  const sendText = async (body: string) => {
    setError('');
    const { data, error: err } = await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: me, kind: 'text', body }).select(SEL).single();
    if (err) { setError(t('chat.sendFailed')); return false; }
    push(data as Message); return true;
  };
  const submit = async (e: FormEvent) => { e.preventDefault(); const b = text.trim(); if (!b) return; setText(''); if (!(await sendText(b))) setText(b); };

  const sendFile = async (file: File, extra?: { kind?: Message['kind']; body?: string; duration?: number }) => {
    setError(''); setBusy(true);
    try { push(await sendMedia({ convId: conv.id, me, file, ...extra })); }
    catch (e) { setError(e instanceof TooBigError ? t('chat.tooBig', { max: MAX_MB }) : t('chat.uploadFailed')); }
    finally { setBusy(false); }
  };
  const sendVoice = async (r: RecResult, body?: string) =>
    sendFile(new File([r.blob], `voice-${Date.now()}.${extOf(r.mime)}`, { type: r.mime }), { kind: 'audio', duration: r.seconds, body });

  const startRecording = () => { setError(''); setRecording(true); };

  const typingNames = Object.keys(typing).map((id) => names[id]).filter(Boolean);
  const peerOnline = !conv.is_group && peer && online.has(peer.id);
  const subtitle = typingNames.length ? (conv.is_group ? t('chat.someoneTyping', { names: typingNames.join(', ') }) : t('chats.typing'))
    : conv.is_group ? conv.members.map((m) => m.profile.display_name).join(', ')
    : peerOnline ? t('chats.online') : peer ? t('chats.lastSeen', { time: formatLastSeen(peer.last_seen, i18n.language, t) }) : '';
  const shown = query.trim() ? messages.filter((m) => m.body?.toLowerCase().includes(query.trim().toLowerCase())) : messages;
  const iconBtn = 'w-10 h-10 shrink-0 grid place-items-center rounded-full hover:bg-bubbleIn text-muted';

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 px-3 py-2.5 bg-panel border-b border-line safe-top">
        <button onClick={onBack} aria-label={t('chat.back')} className="md:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-bubbleIn"><ArrowLeft /></button>
        <Avatar name={titleOf(conv, me)} url={avatarOf(conv, me)} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate">{titleOf(conv, me)}</div>
          <div className={`text-xs truncate ${typingNames.length || peerOnline ? 'text-brand-hover font-semibold' : 'text-muted'}`}>{subtitle}</div>
        </div>
        {!conv.is_group && peer && (<>
          <button onClick={() => void callMgr?.call(peer.id, 'audio')} disabled={callState.phase !== 'idle'} aria-label={t('call.voice')} className={`${iconBtn} disabled:opacity-40`}><Phone size={20} /></button>
          <button onClick={() => void callMgr?.call(peer.id, 'video')} disabled={callState.phase !== 'idle'} aria-label={t('call.video')} className={`${iconBtn} disabled:opacity-40`}><Video size={20} /></button>
        </>)}
        <button onClick={() => setMenu((o) => !o)} aria-label={t('translate.title')} className={`${iconBtn} ${prefs.autoTranslate ? 'text-brand' : ''}`}><Globe size={20} /></button>
        <button onClick={() => { setSearchOpen((o) => !o); setQuery(''); }} aria-label={t('chat.search')} className={iconBtn}>{searchOpen ? <X size={20} /> : <Search size={20} />}</button>
      </header>
      {menu && <TranslateMenu prefs={prefs} set={setPrefs} onClose={() => setMenu(false)} />}
      {searchOpen && <div className="px-3 py-2 bg-panel border-b border-line"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('chat.search')} className="w-full rounded-xl bg-bubbleIn px-4 py-2.5 outline-none" /></div>}

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-3 md:px-8 py-4 flex flex-col gap-1.5">
        {query && shown.length === 0 && <p className="m-auto text-muted">{t('chat.noResults')}</p>}
        {shown.map((m) => {
          const mine = m.sender_id === me; const tick = mine ? tickOf(m) : null;
          const tr = trans[m.id]; const translated = !mine && prefs.autoTranslate && tr && tr !== 'fail' && !tr.same ? tr : null;
          const speakable = !!m.body && ttsSupported;
          return (
            <div key={m.id} className={`flex items-end gap-1 ${mine ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-brand text-brand-ink rounded-br-md' : 'bg-bubbleIn text-ink rounded-bl-md'}`}>
                {conv.is_group && !mine && <div className="text-xs font-bold text-brand-hover mb-0.5">{names[m.sender_id]}</div>}
                {m.kind !== 'text' && <MediaBubble m={m} />}
                {m.body && (translated ? (<>
                  <p className="whitespace-pre-wrap break-words text-[17px] font-medium leading-snug">{translated.text}</p>
                  <p className="whitespace-pre-wrap break-words text-xs text-muted mt-1">{m.body}</p>
                  <p className="text-[10px] text-muted font-semibold">[{(translated.from ?? 'auto').toUpperCase()} → {prefs.myLang.toUpperCase()}]</p>
                </>) : <p className={`whitespace-pre-wrap break-words ${m.kind !== 'text' ? 'mt-1.5' : ''}`}>{m.body}</p>)}
                {!mine && prefs.autoTranslate && tr === 'fail' && <p className="text-[10px] text-muted">{t('chat.translateFailed')}</p>}
                <div className={`flex items-center justify-end gap-1 mt-0.5 text-[11px] ${mine ? 'text-brand-ink/70' : 'text-muted'}`}>
                  {formatTime(m.created_at, i18n.language)}
                  {tick && <span title={t(`status.${tick}`)} aria-label={t(`status.${tick}`)} className={tick === 'read' ? 'text-white' : 'text-brand-ink/50'}>{tick === 'sent' ? <Check size={15} /> : <CheckCheck size={15} />}</span>}
                </div>
              </div>
              {speakable && (
                <button onClick={() => toggleSpeak(m)} aria-label={speakingId === m.id ? t('chat.stopSpeak') : t('chat.speak')} className="w-8 h-8 mb-1 shrink-0 grid place-items-center rounded-full text-muted hover:bg-bubbleIn">
                  {speakingId === m.id ? <Square size={15} className="text-brand" /> : <Volume2 size={17} />}
                </button>)}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {(error || busy) && <p role="alert" className={`px-4 pb-1 text-sm ${error ? 'text-red-500' : 'text-muted'}`}>{error || t('chat.uploading')}</p>}
      {recording ? (
        <RecordBar onCancel={() => setRecording(false)} onDenied={() => { setRecording(false); setError(t('chat.micDenied')); }}
          onSend={(r) => { setRecording(false); void sendVoice(r); }} />
      ) : (
        <form onSubmit={submit} className="flex items-end gap-1 p-2 bg-panel border-t border-line safe-bottom">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('chat.attachFile')} className={iconBtn}><Paperclip size={20} /></button>
          <input ref={fileRef} type="file" hidden accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,*/*" multiple
            onChange={async (e) => { for (const f of [...(e.target.files ?? [])]) await sendFile(f); e.target.value = ''; }} />
          <button type="button" onClick={() => setScan(true)} aria-label={t('chat.camera')} className={iconBtn}><Camera size={20} /></button>
          <textarea rows={1} value={text} onChange={(e) => onType(e.target.value)} placeholder={t('chat.placeholder')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            className="flex-1 min-w-0 resize-none max-h-32 rounded-2xl bg-bubbleIn px-4 py-2.5 outline-none" />
          <button type="button" onClick={() => setDictate(true)} aria-label={t('chat.dictate')} className={iconBtn}><MessageSquareText size={20} /></button>
          {text.trim() ? (
            <button type="submit" aria-label={t('chat.send')} className="w-11 h-11 shrink-0 rounded-full bg-brand hover:bg-brand-hover text-brand-ink grid place-items-center"><Send size={20} /></button>
          ) : (
            <button type="button" onClick={startRecording} aria-label={t('chat.mic')} className="w-11 h-11 shrink-0 rounded-full bg-brand hover:bg-brand-hover text-brand-ink grid place-items-center"><Mic size={20} /></button>
          )}
        </form>
      )}
      {scan && <ScanDialog onClose={() => setScan(false)} onSend={(f) => sendFile(f, { kind: 'file' })} />}
      {dictate && <DictateDialog myLang={prefs.myLang} sendLang={prefs.sendLang} onClose={() => setDictate(false)}
        onSendText={async (s) => { await sendText(s); }} onSendVoice={(r, s) => sendVoice(r, s)} />}
    </div>
  );
}
