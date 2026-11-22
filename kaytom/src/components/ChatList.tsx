import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Settings, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { avatarOf, formatTime, peerOf, titleOf } from '../lib/chat';
import type { Conversation, Profile } from '../types';
import Avatar from './Avatar';
import { loadContacts } from '../lib/contacts';

interface Props {
  me: string; profile: Profile; convs: Conversation[]; activeId: string | null; online: Set<string>;
  onSelect: (id: string) => void; onOpenSettings: () => void; onCreated: (id: string) => void | Promise<void>;
}

export default function ChatList({ me, profile, convs, activeId, online, onSelect, onOpenSettings, onCreated }: Props) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? convs.filter((c) => titleOf(c, me).toLowerCase().includes(s)) : convs;
  }, [convs, q, me]);

  const preview = (c: Conversation) => {
    if (!c.last_message_kind) return t('chats.noMessages');
    if (c.last_message_kind === 'text') return c.last_message_preview ?? '';
    return t(`chat.${c.last_message_kind === 'audio' ? 'voice' : c.last_message_kind}`);
  };

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 safe-top">
        <button onClick={onOpenSettings} aria-label={t('settings.title')} className="rounded-full">
          <Avatar name={profile.display_name} url={profile.avatar_url} size={40} />
        </button>
        <h1 className="flex-1 text-xl font-extrabold tracking-tight">{t('chats.title')}</h1>
        <button onClick={() => setDialog(true)} aria-label={t('chats.newChat')}
          className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-brand-ink grid place-items-center transition-colors"><Plus /></button>
        <button onClick={onOpenSettings} aria-label={t('settings.title')} className="w-10 h-10 rounded-full hover:bg-bubbleIn grid place-items-center text-muted"><Settings size={20} /></button>
      </header>
      <div className="px-4 pb-3">
        <label className="flex items-center gap-2 rounded-xl bg-bubbleIn px-3 py-2.5">
          <Search size={18} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chats.searchPlaceholder')} className="flex-1 bg-transparent outline-none" />
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto scroll-thin">
        {list.length === 0 && <li className="p-8 text-center text-muted">{t('chats.empty')}</li>}
        {list.map((c) => {
          const peer = peerOf(c, me);
          const isOnline = !c.is_group && peer && online.has(peer.id);
          return (
            <li key={c.id}>
              <button onClick={() => onSelect(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bubbleIn ${c.id === activeId ? 'bg-bubbleIn' : ''}`}>
                <div className="relative">
                  <Avatar name={titleOf(c, me)} url={avatarOf(c, me)} />
                  {isOnline && <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-brand border-2 border-panel" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold truncate">{titleOf(c, me)}</span>
                    {c.last_message_kind && <span className="text-xs text-muted shrink-0">{formatTime(c.last_message_at, i18n.language)}</span>}
                  </div>
                  <p className="text-sm text-muted truncate">{preview(c)}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {dialog && <NewChatDialog me={me} onClose={() => setDialog(false)} onPick={async (id) => { setDialog(false); await onCreated(id); }} />}
    </>
  );
}

function NewChatDialog({ me, onClose, onPick }: { me: string; onClose: () => void; onPick: (id: string) => void | Promise<void> }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Profile[]>([]);
  const [searched, setSearched] = useState(false);
  const [contacts, setContacts] = useState<Profile[]>([]);
  useEffect(() => { void loadContacts().then(setContacts); }, []);

  useEffect(() => {
    const s = q.trim().replace(/[%,]/g, '');
    if (s.length < 3) { setRes([]); setSearched(false); return; }
    const h = setTimeout(async () => {
      const { data } = await supabase.rpc('search_profiles', { q: s });
      setRes((data ?? []) as Profile[]); setSearched(true);
    }, 250);
    return () => clearTimeout(h);
  }, [q, me]);

  const start = async (p: Profile) => {
    const { data, error } = await supabase.rpc('create_direct_conversation', { other: p.id });
    if (!error && data) await onPick(data as string);
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-panel border border-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4">
          <h2 className="font-extrabold text-lg">{t('chats.newChat')}</h2>
          <button onClick={onClose} aria-label={t('common.close')}><X /></button>
        </div>
        <div className="px-4 pb-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chats.findPeople')}
            className="w-full rounded-xl bg-bubbleIn px-4 py-3 outline-none" />
        </div>
        <ul className="overflow-y-auto scroll-thin pb-2">
          {searched && res.length === 0 && <li className="p-6 text-center text-muted">{t('chats.noPeople')}</li>}
          {!searched && contacts.length > 0 && <li className="px-4 pt-1 pb-1 text-xs font-bold text-muted uppercase tracking-wide">{t('contacts.title')}</li>}
          {(searched ? res : contacts).map((p) => (
            <li key={p.id}>
              <button onClick={() => start(p)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bubbleIn text-left">
                <Avatar name={p.display_name} url={p.avatar_url} size={40} />
                <div className="min-w-0"><div className="font-bold truncate">{p.display_name}</div><div className="text-sm text-muted truncate">@{p.username}</div></div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
