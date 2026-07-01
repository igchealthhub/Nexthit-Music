-- NextHit Music: song upload RLS + pending upload RPC

alter table public.songs enable row level security;

drop policy if exists songs_public_read_approved on public.songs;
drop policy if exists "Public view approved songs" on public.songs;
create policy songs_public_read_approved
on public.songs
for select
using (status = 'approved');

drop policy if exists songs_artist_insert_own on public.songs;
drop policy if exists "Artists insert songs" on public.songs;
create policy songs_artist_insert_own
on public.songs
for insert
with check (
  exists (
    select 1
    from public.artist_profiles ap
    join public.profiles p on p.id = coalesce(ap.user_id, ap.id)
    where ap.id = songs.artist_id
      and coalesce(ap.user_id, ap.id) = auth.uid()
      and (p.role = 'artist' or p.is_admin = true)
  )
);

drop policy if exists songs_artist_read_own on public.songs;
drop policy if exists "Artists view own songs" on public.songs;
create policy songs_artist_read_own
on public.songs
for select
using (
  exists (
    select 1
    from public.artist_profiles ap
    where ap.id = songs.artist_id
      and coalesce(ap.user_id, ap.id) = auth.uid()
  )
);

drop policy if exists songs_artist_update_own on public.songs;
drop policy if exists "Artists update own songs" on public.songs;
create policy songs_artist_update_own
on public.songs
for update
using (
  exists (
    select 1
    from public.artist_profiles ap
    where ap.id = songs.artist_id
      and coalesce(ap.user_id, ap.id) = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.artist_profiles ap
    where ap.id = songs.artist_id
      and coalesce(ap.user_id, ap.id) = auth.uid()
  )
);

drop policy if exists songs_artist_delete_own on public.songs;
drop policy if exists "Artists delete own songs" on public.songs;
create policy songs_artist_delete_own
on public.songs
for delete
using (
  exists (
    select 1
    from public.artist_profiles ap
    where ap.id = songs.artist_id
      and coalesce(ap.user_id, ap.id) = auth.uid()
  )
);

drop policy if exists songs_admin_read_all on public.songs;
drop policy if exists "Admins view all songs" on public.songs;
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
drop policy if exists "Admins update all songs" on public.songs;
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

create or replace function public.create_pending_song_upload(
  p_title text,
  p_description text,
  p_genre_id bigint,
  p_genre text,
  p_price numeric,
  p_audio_url text,
  p_cover_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  artist_profile_id uuid := null;
  has_genre_id_column boolean := false;
  has_genre_column boolean := false;
  has_cover_url_column boolean := false;
  has_created_at_column boolean := false;
  cols text[] := array['artist_id', 'title', 'description', 'price', 'status', 'audio_url'];
  vals text[] := array['$1', '$2', '$3', '$4', quote_literal('pending'), '$5'];
  insert_sql text;
  song_row record;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select ap.id
  into artist_profile_id
  from public.artist_profiles ap
  join public.profiles p on p.id = coalesce(ap.user_id, ap.id)
  where coalesce(ap.user_id, ap.id) = caller_id
    and (p.role = 'artist' or p.is_admin = true)
  limit 1;

  if artist_profile_id is null then
    raise exception 'Artist profile not found or not allowed for user %', caller_id using errcode = '42501';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'songs' and column_name = 'genre_id'
  ) into has_genre_id_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'songs' and column_name = 'genre'
  ) into has_genre_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'songs' and column_name = 'cover_url'
  ) into has_cover_url_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'songs' and column_name = 'created_at'
  ) into has_created_at_column;

  if has_genre_id_column and p_genre_id is not null then
    cols := array_append(cols, 'genre_id');
    vals := array_append(vals, '$7');
  elsif has_genre_column and p_genre is not null and length(trim(p_genre)) > 0 then
    cols := array_append(cols, 'genre');
    vals := array_append(vals, '$8');
  end if;

  if has_cover_url_column then
    cols := array_append(cols, 'cover_url');
    vals := array_append(vals, '$6');
  end if;

  if has_created_at_column then
    cols := array_append(cols, 'created_at');
    vals := array_append(vals, 'now()');
  end if;

  insert_sql := format(
    'insert into public.songs (%s) values (%s) returning id, title, status, artist_id, audio_url, price',
    array_to_string(cols, ', '),
    array_to_string(vals, ', ')
  );

  execute insert_sql
    using artist_profile_id, p_title, p_description, p_price, p_audio_url, p_cover_url, p_genre_id, p_genre
    into song_row;

  return jsonb_build_object(
    'status', 'ok',
    'song', jsonb_build_object(
      'id', song_row.id,
      'title', song_row.title,
      'status', song_row.status,
      'artist_id', song_row.artist_id,
      'audio_url', song_row.audio_url,
      'cover_url', p_cover_url,
      'price', song_row.price
    )
  );
end;
$$;

revoke all on function public.create_pending_song_upload(text, text, uuid, text, numeric, text, text) from public;
revoke all on function public.create_pending_song_upload(text, text, bigint, text, numeric, text, text) from public;
grant execute on function public.create_pending_song_upload(text, text, bigint, text, numeric, text, text) to authenticated;
