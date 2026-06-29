-- Admin pending-song notifications
-- Run in Supabase SQL Editor.

alter table public.notifications enable row level security;

-- Ensure users (including admins) can read only their own notifications.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (user_id = auth.uid());

-- Allow users to mark their own notifications read.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Allow users to dismiss their own notifications.
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
on public.notifications
for delete
using (user_id = auth.uid());

-- RPC for creating admin-only pending-approval notifications.
create or replace function public.notify_admins_song_pending(p_song_id uuid, p_song_title text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_artist boolean := false;
  inserted_count integer := 0;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = caller_id
      and (p.role = 'artist' or p.is_admin = true)
  )
  into caller_is_artist;

  if not caller_is_artist then
    raise exception 'Only artists or admins can notify pending songs' using errcode = '42501';
  end if;

  insert into public.notifications (user_id, type, title, body, link, read)
  select
    admin_profiles.id,
    'admin_song_pending',
    'New song pending approval: ' || coalesce(nullif(trim(p_song_title), ''), 'Untitled Song'),
    'A new artist submission is awaiting review.',
    '/admin',
    false
  from public.profiles admin_profiles
  where admin_profiles.is_admin = true;

  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'inserted', inserted_count,
    'song_id', p_song_id
  );
end;
$$;

revoke all on function public.notify_admins_song_pending(uuid, text) from public;
grant execute on function public.notify_admins_song_pending(uuid, text) to authenticated;
