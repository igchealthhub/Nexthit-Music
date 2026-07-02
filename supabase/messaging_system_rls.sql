-- Messaging system tables + RLS hardening
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_admin = true
  );
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_fan_artist_unique unique (fan_id, artist_id),
  constraint conversations_fan_artist_diff check (fan_id <> artist_id)
);

alter table public.conversations enable row level security;

create index if not exists conversations_fan_id_idx on public.conversations(fan_id);
create index if not exists conversations_artist_id_idx on public.conversations(artist_id);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);

alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
alter table public.messages add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists body text;
alter table public.messages add column if not exists read boolean not null default false;
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists created_at timestamptz not null default now();

-- Legacy records that were marked as read=true should also get read_at.
update public.messages
set read_at = coalesce(read_at, created_at, now())
where read = true
  and read_at is null;

-- Keep read boolean in sync for existing UI paths.
update public.messages
set read = true
where read_at is not null
  and read = false;

create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_recipient_id_idx on public.messages(recipient_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);

alter table public.messages enable row level security;

-- Realtime should include messaging rows.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

drop policy if exists conversations_select_participant_or_admin on public.conversations;
create policy conversations_select_participant_or_admin
on public.conversations
for select
using (
  auth.uid() is not null
  and (
    fan_id = auth.uid()
    or artist_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
);

drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant
on public.conversations
for insert
with check (
  auth.uid() is not null
  and (
    fan_id = auth.uid()
    or artist_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
);

drop policy if exists conversations_update_participant_or_admin on public.conversations;
create policy conversations_update_participant_or_admin
on public.conversations
for update
using (
  auth.uid() is not null
  and (
    fan_id = auth.uid()
    or artist_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
)
with check (
  auth.uid() is not null
  and (
    fan_id = auth.uid()
    or artist_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
);

drop policy if exists messages_select_participant_or_admin on public.messages;
create policy messages_select_participant_or_admin
on public.messages
for select
using (
  auth.uid() is not null
  and (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
);

drop policy if exists messages_insert_sender_or_admin on public.messages;
create policy messages_insert_sender_or_admin
on public.messages
for insert
with check (
  auth.uid() is not null
  and (
    sender_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
  and sender_id is not null
  and recipient_id is not null
  and sender_id <> recipient_id
  and body is not null
  and length(trim(body)) > 0
);

-- Recipient can mark read/read_at; admin can troubleshoot updates.
drop policy if exists messages_update_recipient_or_admin on public.messages;
create policy messages_update_recipient_or_admin
on public.messages
for update
using (
  auth.uid() is not null
  and (
    recipient_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
)
with check (
  auth.uid() is not null
  and (
    recipient_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
);

drop policy if exists messages_delete_sender_or_admin on public.messages;
create policy messages_delete_sender_or_admin
on public.messages
for delete
using (
  auth.uid() is not null
  and (
    sender_id = auth.uid()
    or public.is_admin_user(auth.uid())
  )
);

create or replace function public.bump_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.conversation_id is not null then
    update public.conversations
    set updated_at = now()
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_bump_conversation on public.messages;
create trigger trg_messages_bump_conversation
after insert on public.messages
for each row
execute function public.bump_conversation_updated_at();

create or replace function public.create_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.notifications (user_id, type, title, body, link, read)
    values (
      new.recipient_id,
      'message',
      'New message',
      left(coalesce(new.body, ''), 140),
      '/messages',
      false
    );
  exception
    when undefined_table then
      null;
    when undefined_column then
      null;
    when others then
      -- Keep message creation successful even if notification insert fails.
      null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_messages_notify_recipient on public.messages;
create trigger trg_messages_notify_recipient
after insert on public.messages
for each row
execute function public.create_message_notification();

create or replace function public.admin_recent_messages(p_limit integer default 100)
returns table (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  body text,
  read boolean,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.sender_id, m.recipient_id, m.body, m.read, m.read_at, m.created_at
  from public.messages m
  where public.is_admin_user(auth.uid())
  order by m.created_at desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

revoke all on function public.admin_recent_messages(integer) from public;
grant execute on function public.admin_recent_messages(integer) to authenticated;
