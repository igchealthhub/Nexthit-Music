-- Storage bucket + RLS policies for song uploads
-- Run in Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values
  ('songs', 'songs', true),
  ('covers', 'covers', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

-- Public read for playback/cover rendering.
drop policy if exists storage_public_read_songs_covers on storage.objects;
create policy storage_public_read_songs_covers
on storage.objects
for select
using (bucket_id in ('songs', 'covers'));

-- Artists/admins can upload into their own folder prefix: auth.uid()/...
drop policy if exists storage_artist_insert_songs_covers on storage.objects;
create policy storage_artist_insert_songs_covers
on storage.objects
for insert
with check (
  bucket_id in ('songs', 'covers')
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'artist' or p.is_admin = true)
  )
);

-- Owner/admin updates in song/cover buckets.
drop policy if exists storage_owner_update_songs_covers on storage.objects;
create policy storage_owner_update_songs_covers
on storage.objects
for update
using (
  bucket_id in ('songs', 'covers')
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  )
)
with check (
  bucket_id in ('songs', 'covers')
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  )
);

-- Owner/admin delete in song/cover buckets.
drop policy if exists storage_owner_delete_songs_covers on storage.objects;
create policy storage_owner_delete_songs_covers
on storage.objects
for delete
using (
  bucket_id in ('songs', 'covers')
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  )
);
