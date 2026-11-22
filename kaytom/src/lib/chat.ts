import type { Conversation, Message, Profile, Tick } from '../types';

export const peerOf = (c: Conversation, me: string): Profile | undefined =>
  c.members.find((m) => m.user_id !== me)?.profile;

export const titleOf = (c: Conversation, me: string) =>
  c.is_group ? c.name ?? '' : peerOf(c, me)?.display_name ?? '';

export const avatarOf = (c: Conversation, me: string) =>
  c.is_group ? c.avatar_url : peerOf(c, me)?.avatar_url ?? null;

export function tickOf(m: Message): Tick {
  const r = m.receipts ?? [];
  if (r.length && r.every((x) => x.read_at)) return 'read';
  if (r.length && r.every((x) => x.delivered_at)) return 'delivered';
  return 'sent';
}

export function formatTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

export function formatLastSeen(iso: string, lang: string, t: (k: string) => string) {
  const d = new Date(iso); const now = new Date();
  const time = formatTime(iso, lang);
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay) return `${t('chats.today')} ${time}`;
  if (d.toDateString() === y.toDateString()) return `${t('chats.yesterday')} ${time}`;
  return `${d.toLocaleDateString(lang)} ${time}`;
}
