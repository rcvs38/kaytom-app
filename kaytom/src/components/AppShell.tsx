import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { playBeep, showSystemNotification } from '../lib/notify';
import { titleOf } from '../lib/chat';
import type { Conversation, Message, Profile } from '../types';
import ChatList from './ChatList';
import ChatView from './ChatView';
import SettingsPanel from './SettingsPanel';
import CallLayer from './CallLayer';
import { CallProvider } from '../lib/callContext';
import { startupPermissionsThenSync } from '../lib/permissions';

export default function AppShell({ session }: { session: Session }) {
  const { t } = useTranslation();
  const me = session.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeRef = useRef<string | null>(null);
  const convsRef = useRef<Conversation[]>([]);
  activeRef.current = activeId; convsRef.current = convs;

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', me).single();
    if (data) setProfile(data as Profile);
  }, [me]);

  const loadConvs = useCallback(async () => {
    const { data: mem } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', me);
    const ids = (mem ?? []).map((m) => m.conversation_id);
    if (!ids.length) return setConvs([]);
    const { data } = await supabase
      .from('conversations')
      .select('*, members:conversation_members(user_id, role, profile:profiles(*))')
      .in('id', ids).order('last_message_at', { ascending: false });
    setConvs((data ?? []) as unknown as Conversation[]);
  }, [me]);

  useEffect(() => { void loadProfile(); void loadConvs(); void supabase.rpc('mark_delivered'); }, [loadProfile, loadConvs]);

  // Global presence + last_seen
  useEffect(() => {
    const ch = supabase.channel('presence:global', { config: { presence: { key: me } } });
    ch.on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe((s) => { if (s === 'SUBSCRIBED') void ch.track({ at: Date.now() }); });
    const beat = () => void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', me);
    beat(); const iv = setInterval(beat, 60_000);
    window.addEventListener('beforeunload', beat);
    return () => { clearInterval(iv); window.removeEventListener('beforeunload', beat); void supabase.removeChannel(ch); beat(); };
  }, [me]);

  // Global realtime: new messages (sound, notification, delivery) & list refresh
  useEffect(() => {
    const ch = supabase.channel('shell:' + me)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new as Message;
        void loadConvs();
        if (m.sender_id === me) return;
        void supabase.rpc('mark_delivered');
        const viewing = activeRef.current === m.conversation_id && document.visibilityState === 'visible';
        if (!viewing) {
          playBeep();
          const c = convsRef.current.find((x) => x.id === m.conversation_id);
          const sender = c?.members.find((x) => x.user_id === m.sender_id)?.profile.display_name ?? '';
          showSystemNotification(c ? (c.is_group ? `${c.name} · ${sender}` : sender) : 'KAYTOM',
            m.body ?? t(`chat.${m.kind === 'audio' ? 'voice' : m.kind}`));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => void loadConvs())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const np = p.new as Profile;
        if (np.id === me) setProfile(np);
        setConvs((cs) => cs.map((c) => ({ ...c, members: c.members.map((mm) => mm.user_id === np.id ? { ...mm, profile: np } : mm) })));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [me, loadConvs, t]);

  useEffect(() => { void startupPermissionsThenSync(); }, []);

  const active = convs.find((c) => c.id === activeId) ?? null;

  if (!profile) return <div className="h-full grid place-items-center text-muted">{t('common.loading')}</div>;

  return (
    <CallProvider me={me}>
    <div className="h-full flex bg-app">
      {/* Sol panel: mobilde sohbet açıkken gizlenir */}
      <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] lg:w-[400px] shrink-0 flex-col border-r border-line bg-panel`}>
        <ChatList me={me} profile={profile} convs={convs} activeId={activeId} online={online}
          onSelect={setActiveId} onOpenSettings={() => setSettingsOpen(true)}
          onCreated={async (id) => { await loadConvs(); setActiveId(id); }} />
      </aside>
      {/* Sağ panel */}
      <section className={`${active ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col`}>
        {active ? (
          <ChatView key={active.id} conv={active} me={me} online={online} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex-1 grid place-items-center text-center p-8 text-muted">
            <div><div className="mx-auto mb-4 w-16 h-16 rounded-3xl bg-brand-soft grid place-items-center text-brand-ink"><MessageCircle size={30} /></div>
              <p>{t('chat.select')}</p></div>
          </div>
        )}
      </section>
      {settingsOpen && <SettingsPanel profile={profile} onClose={() => setSettingsOpen(false)} onSaved={loadProfile} />}
      <CallLayer convs={convs} />
    </div>
    </CallProvider>
  );
}
