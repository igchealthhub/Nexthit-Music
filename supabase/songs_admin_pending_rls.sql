-- Songs RLS for artist upload + admin pending approvals
-- Run in Supabase SQL Editor.

alter table public.songs enable row level security;

-- Public can browse approved songs.
drop policy if exists songs_public_read_approved on public.songs;
create policy songs_public_read_approved
on public.songs
for select
using (status = 'approved');

-- Artists can insert songs for themselves (pending by default from app).
drop policy if exists songs_artist_insert_own on public.songs;
create policy songs_artist_insert_own
on public.songs
for insert
with check (
  artist_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'artist' or p.is_admin = true)
  )
);

-- Artists can read only their own songs.
drop policy if exists songs_artist_read_own on public.songs;
create policy songs_artist_read_own
on public.songs
for select
using (
  artist_id = auth.uid()
);

-- Artists can update/delete only their own songs.
drop policy if exists songs_artist_update_own on public.songs;
create policy songs_artist_update_own
on public.songs
for update
using (artist_id = auth.uid())
with check (artist_id = auth.uid());

drop policy if exists songs_artist_delete_own on public.songs;
create policy songs_artist_delete_own
on public.songs
for delete
using (artist_id = auth.uid());

-- Admins can read and moderate all songs.
drop policy if exists songs_admin_read_all on public.songs;
create policy songs_admin_read_all
on public.songs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists songs_admin_update_all on public.songs;
create policy songs_admin_update_all
on public.songs
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists songs_admin_delete_all on public.songs;
create policy songs_admin_delete_all
on public.songs
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);
