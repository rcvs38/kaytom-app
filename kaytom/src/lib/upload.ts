import { supabase } from './supabase';
import type { Message } from '../types';

export const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB || 50);
export const kindOf = (mime: string): Message['kind'] =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';

export class TooBigError extends Error {}

export async function sendMedia(o: { convId: string; me: string; file: File; kind?: Message['kind']; body?: string; duration?: number }): Promise<Message> {
  if (o.file.size > MAX_MB * 1024 * 1024) throw new TooBigError(String(MAX_MB));
  const safe = o.file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${o.convId}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage.from('media').upload(path, o.file, { contentType: o.file.type || 'application/octet-stream' });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: o.convId, sender_id: o.me, kind: o.kind ?? kindOf(o.file.type), body: o.body ?? null,
    media_path: path, media_name: o.file.name, media_mime: o.file.type, media_size: o.file.size, duration_seconds: o.duration ?? null,
  }).select('*, receipts:message_receipts(user_id, delivered_at, read_at)').single();
  if (error) throw error;
  return data as Message;
}

const urls = new Map<string, { url: string; exp: number }>();
export async function signedUrl(path: string): Promise<string | null> {
  const c = urls.get(path); if (c && c.exp > Date.now()) return c.url;
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 3600);
  if (!data) return null;
  urls.set(path, { url: data.signedUrl, exp: Date.now() + 3000_000 });
  return data.signedUrl;
}
