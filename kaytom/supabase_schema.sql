-- KAYTOM şeması: Supabase SQL Editor'de tek seferde çalıştırın.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  about text not null default 'Hey there! I am using KAYTOM.',
  avatar_url text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  description text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_message_kind text
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.conversation_members(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','image','video','file','audio')),
  body text,
  media_path text,
  media_name text,
  media_mime text,
  media_size bigint,
  duration_seconds int,
  created_at timestamptz not null default now()
);
create index on public.messages(conversation_id, created_at);

create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index on public.message_receipts(user_id) where read_at is null;

-- Yardımcı fonksiyonlar (RLS özyinelemesini önlemek için security definer)
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = cid and user_id = auth.uid());
$$;
create or replace function public.is_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = cid and user_id = auth.uid() and role = 'admin');
$$;

-- Yeni kullanıcı => profil
-- Rehber eşleştirme: yalnızca e-postanın SHA-256 özeti saklanır; tabloyu istemci okuyamaz
create table public.contact_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_hash text not null unique
);
alter table public.contact_keys enable row level security;
revoke all on public.contact_keys from anon, authenticated;

create table public.contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);
alter table public.contacts enable row level security;
create policy "contacts own read" on public.contacts for select to authenticated using (owner_id = auth.uid());
revoke insert, update, delete on public.contacts from authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)));
  if exists (select 1 from profiles where username = uname) then
    uname := uname || substr(replace(new.id::text,'-',''),1,4);
  end if;
  insert into profiles (id, username, display_name)
  values (new.id, uname, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), uname));
  insert into contact_keys (user_id, email_hash)
  values (new.id, encode(sha256(convert_to(lower(trim(new.email)), 'UTF8')), 'hex'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Yeni mesaj => alıcılar için makbuz satırları + sohbet özeti
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into message_receipts (message_id, user_id)
  select new.id, user_id from conversation_members
  where conversation_id = new.conversation_id and user_id <> new.sender_id;
  update conversations set last_message_at = new.created_at,
    last_message_preview = left(coalesce(new.body,''), 120), last_message_kind = new.kind
  where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;
create trigger trg_message_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- RPC'ler
create or replace function public.create_direct_conversation(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if other = auth.uid() then raise exception 'cannot chat with yourself'; end if;
  select c.id into cid from conversations c
   where not c.is_group
     and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = auth.uid())
     and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = other)
   limit 1;
  if cid is null then
    insert into conversations (is_group, created_by) values (false, auth.uid()) returning id into cid;
    insert into conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, other);
  end if;
  return cid;
end $$;

create or replace function public.create_group(group_name text, member_ids uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; uid uuid;
begin
  insert into conversations (is_group, name, created_by) values (true, group_name, auth.uid()) returning id into cid;
  insert into conversation_members (conversation_id, user_id, role) values (cid, auth.uid(), 'admin');
  foreach uid in array member_ids loop
    if uid <> auth.uid() then
      insert into conversation_members (conversation_id, user_id) values (cid, uid) on conflict do nothing;
    end if;
  end loop;
  return cid;
end $$;

create or replace function public.add_group_member(cid uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(cid) then raise exception 'admin only'; end if;
  if not exists (select 1 from conversations where id = cid and is_group) then raise exception 'not a group'; end if;
  insert into conversation_members (conversation_id, user_id) values (cid, uid) on conflict do nothing;
end $$;

create or replace function public.remove_group_member(cid uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if uid <> auth.uid() and not is_admin(cid) then raise exception 'admin only'; end if;
  delete from conversation_members where conversation_id = cid and user_id = uid;
end $$;

create or replace function public.set_member_role(cid uuid, uid uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(cid) then raise exception 'admin only'; end if;
  update conversation_members set role = new_role where conversation_id = cid and user_id = uid;
end $$;

create or replace function public.update_group_info(cid uuid, new_name text, new_description text, new_avatar text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(cid) then raise exception 'admin only'; end if;
  update conversations set name = new_name, description = new_description, avatar_url = new_avatar
  where id = cid and is_group;
end $$;

create or replace function public.mark_delivered() returns void
language sql security definer set search_path = public as $$
  update message_receipts set delivered_at = now() where user_id = auth.uid() and delivered_at is null;
$$;

create or replace function public.mark_read(cid uuid) returns void
language sql security definer set search_path = public as $$
  update message_receipts r set read_at = now(), delivered_at = coalesce(r.delivered_at, now())
  from messages m
  where r.message_id = m.id and m.conversation_id = cid and r.user_id = auth.uid() and r.read_at is null;
  update conversation_members set last_read_at = now() where conversation_id = cid and user_id = auth.uid();
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;

create or replace function public.shares_chat(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members a join conversation_members b on a.conversation_id = b.conversation_id
                 where a.user_id = auth.uid() and b.user_id = uid);
$$;
-- Herkes yalnızca kendi profilini ve yazıştığı kişilerin profilini görebilir
create policy "profiles self, partners or contacts" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_chat(id)
         or exists (select 1 from public.contacts c where c.owner_id = auth.uid() and c.contact_id = profiles.id));

-- Rehberdeki e-posta özetlerini eşleştirir, bulunanları kişilere kaydeder
create or replace function public.sync_contacts(hashes text[])
returns table (id uuid, username text, display_name text, about text, avatar_url text, last_seen timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(hashes, 1), 0) > 5000 then raise exception 'too many contacts'; end if;
  insert into contacts (owner_id, contact_id)
  select auth.uid(), k.user_id from contact_keys k
  where k.email_hash = any(hashes) and k.user_id <> auth.uid()
  on conflict do nothing;
  return query select p.id, p.username, p.display_name, p.about, p.avatar_url, p.last_seen
    from contacts c join profiles p on p.id = c.contact_id where c.owner_id = auth.uid();
end $$;
revoke all on function public.sync_contacts(text[]) from public, anon;
grant execute on function public.sync_contacts(text[]) to authenticated;

-- Yeni kişi bulma: yalnızca TAM kullanıcı adı eşleşmesi (kullanıcı listesi taranamaz)
create or replace function public.search_profiles(q text)
returns table (id uuid, username text, display_name text, about text, avatar_url text, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.about, p.avatar_url, p.last_seen
  from profiles p where length(trim(q)) >= 3 and p.username = lower(trim(q)) and p.id <> auth.uid();
$$;
revoke all on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "conv members read" on public.conversations for select to authenticated using (public.is_member(id));

create policy "members read" on public.conversation_members for select to authenticated using (public.is_member(conversation_id));

create policy "messages read" on public.messages for select to authenticated using (public.is_member(conversation_id));
create policy "messages insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));
create policy "messages delete own" on public.messages for delete to authenticated using (sender_id = auth.uid());

create policy "receipts read" on public.message_receipts for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));

-- Doğrudan yazma yalnızca yukarıdaki policy'ler ve RPC'ler üzerinden
revoke insert, update, delete on public.conversations, public.conversation_members, public.message_receipts from authenticated;
revoke update on public.messages from authenticated;

-- Realtime
alter publication supabase_realtime add table public.messages, public.message_receipts,
  public.conversation_members, public.conversations, public.profiles;

-- Storage
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('media','media', false, 52428800) on conflict do nothing;

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media member read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "media member write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ===================== SESLİ / GÖRÜNTÜLÜ ARAMA (WebRTC sinyalleşme) =====================
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('audio','video')),
  status text not null default 'calling' check (status in ('calling','ringing','accepted','declined','cancelled','missed','ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
alter table public.calls replica identity full;
alter table public.calls enable row level security;
create policy "calls participants read" on public.calls for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid());
revoke insert, update, delete on public.calls from authenticated;

create table public.call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.call_signals enable row level security;
create policy "signals read" on public.call_signals for select to authenticated
  using (to_id = auth.uid() or from_id = auth.uid());
create policy "signals insert" on public.call_signals for insert to authenticated
  with check (from_id = auth.uid() and exists (
    select 1 from public.calls c where c.id = call_id
      and c.status in ('calling','ringing','accepted')
      and ((c.caller_id = auth.uid() and c.callee_id = to_id) or (c.callee_id = auth.uid() and c.caller_id = to_id))));

create or replace function public.start_call(callee uuid, call_kind text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if callee = auth.uid() or not public.shares_chat(callee) then raise exception 'not allowed'; end if;
  if call_kind not in ('audio','video') then raise exception 'bad kind'; end if;
  update calls set status = 'cancelled', ended_at = now() where caller_id = auth.uid() and status in ('calling','ringing');
  insert into calls (caller_id, callee_id, kind) values (auth.uid(), callee, call_kind) returning id into cid;
  return cid;
end $$;

create or replace function public.call_ringing(cid uuid) returns void
language sql security definer set search_path = public as $$
  update calls set status = 'ringing' where id = cid and callee_id = auth.uid() and status = 'calling';
$$;

create or replace function public.answer_call(cid uuid) returns void
language sql security definer set search_path = public as $$
  update calls set status = 'accepted', answered_at = now()
  where id = cid and callee_id = auth.uid() and status in ('calling','ringing');
$$;

create or replace function public.end_call(cid uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_status not in ('declined','cancelled','missed','ended') then raise exception 'bad status'; end if;
  update calls set status = new_status, ended_at = now()
  where id = cid and (caller_id = auth.uid() or callee_id = auth.uid()) and status in ('calling','ringing','accepted');
end $$;

revoke all on function public.start_call(uuid, text), public.call_ringing(uuid), public.answer_call(uuid), public.end_call(uuid, text) from public, anon;
grant execute on function public.start_call(uuid, text), public.call_ringing(uuid), public.answer_call(uuid), public.end_call(uuid, text) to authenticated;

alter publication supabase_realtime add table public.calls, public.call_signals;
