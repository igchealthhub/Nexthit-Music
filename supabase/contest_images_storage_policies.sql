-- Contest cover image storage setup for bucket: contest-images
-- Safe to run multiple times

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contest-images',
  'contest-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Public read access for contest images
drop policy if exists contest_images_public_read on storage.objects;
create policy contest_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'contest-images');

-- Admin write access (insert/update/delete)
drop policy if exists contest_images_admin_insert on storage.objects;
create policy contest_images_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'contest-images'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists contest_images_admin_update on storage.objects;
create policy contest_images_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'contest-images'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  bucket_id = 'contest-images'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists contest_images_admin_delete on storage.objects;
create policy contest_images_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'contest-images'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);
