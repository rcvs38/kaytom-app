export interface Profile {
  id: string; username: string; display_name: string; about: string;
  avatar_url: string | null; last_seen: string;
}
export interface Member { user_id: string; role: 'admin' | 'member'; profile: Profile }
export interface Conversation {
  id: string; is_group: boolean; name: string | null; description: string | null;
  avatar_url: string | null; last_message_at: string;
  last_message_preview: string | null; last_message_kind: string | null;
  members: Member[];
}
export interface Receipt { user_id: string; delivered_at: string | null; read_at: string | null }
export interface Message {
  id: string; conversation_id: string; sender_id: string;
  kind: 'text' | 'image' | 'video' | 'file' | 'audio';
  body: string | null; media_path: string | null; media_name: string | null;
  media_mime: string | null; media_size: number | null; duration_seconds: number | null;
  created_at: string; receipts?: Receipt[];
}
export type Tick = 'sent' | 'delivered' | 'read';
