-- Artist profiles self-read policy
-- Run in Supabase SQL editor.

alter table public.artist_profiles enable row level security;

drop policy if exists "Artists read own profile" on public.artist_profiles;
create policy "Artists read own profile"
on public.artist_profiles
for select
to authenticated
using (
  user_id = auth.uid()
);
