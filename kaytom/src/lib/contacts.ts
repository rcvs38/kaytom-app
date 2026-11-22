import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import type { Profile } from '../types';

const ASKED = 'kaytom.contactsAsked';
export const canSyncContacts = () => Capacitor.isNativePlatform();
export const contactsAnswered = () => localStorage.getItem(ASKED) !== null;
export const rememberAnswer = (v: boolean) => localStorage.setItem(ASKED, v ? '1' : '0');
export const contactsAllowed = () => localStorage.getItem(ASKED) === '1';

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.trim().toLowerCase()));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Telefon rehberindeki e-postaların SHA-256 özetlerini eşleştirir; bulunanlar otomatik "kişilerim"e kaydedilir. */
export async function syncPhoneContacts(): Promise<Profile[]> {
  if (!canSyncContacts() || !contactsAllowed()) return [];
  const { Contacts } = await import('@capacitor-community/contacts');
  const perm = await Contacts.checkPermissions();
  if (perm.contacts !== 'granted') return [];
  const res = await Contacts.getContacts({ projection: { emails: true } });
  const emails = new Set<string>();
  for (const c of res.contacts) for (const e of c.emails ?? []) if (e.address) emails.add(e.address);
  const hashes = await Promise.all([...emails].slice(0, 5000).map(sha256));
  if (!hashes.length) return [];
  const { data } = await supabase.rpc('sync_contacts', { hashes });
  return (data ?? []) as Profile[];
}

export async function loadContacts(): Promise<Profile[]> {
  const { data } = await supabase.from('contacts').select('profile:profiles!contact_id(*)');
  return ((data ?? []) as unknown as { profile: Profile | null }[]).map((r) => r.profile).filter((p): p is Profile => !!p);
}
