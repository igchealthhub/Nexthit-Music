-- Robust pending song insert RPC for upload flow
-- Run in Supabase SQL Editor.

create or replace function public.create_pending_song_upload(
  p_title text,
  p_description text,
  p_genre_id uuid,
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
  caller_allowed boolean := false;
  has_artist_user_id_column boolean := false;
  artist_owner_id uuid := null;
  has_genre_id_column boolean := false;
  has_genre_column boolean := false;
  has_created_at_column boolean := false;
  cols text[] := array['artist_id', 'title', 'description', 'price', 'status', 'audio_url', 'cover_url'];
  vals text[] := array['$1', '$2', '$3', '$4', quote_literal('pending'), '$5', '$6'];
  insert_sql text;
  song_row record;
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
  into caller_allowed;

  if not caller_allowed then
    raise exception 'Only artists/admins can create pending songs' using errcode = '42501';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_profiles'
      and column_name = 'user_id'
  )
  into has_artist_user_id_column;

  select ap.id
  into artist_owner_id
  from public.artist_profiles ap
  where ap.id = caller_id
  limit 1;

  if artist_owner_id is null and has_artist_user_id_column then
    execute 'select ap.id from public.artist_profiles ap where ap.user_id = $1 limit 1'
      into artist_owner_id
      using caller_id;
  end if;

  if artist_owner_id is null then
    insert into public.artist_profiles (id)
    values (caller_id)
    on conflict (id) do nothing;

    select ap.id
    into artist_owner_id
    from public.artist_profiles ap
    where ap.id = caller_id
    limit 1;
  end if;

  if artist_owner_id is null and has_artist_user_id_column then
    execute 'insert into public.artist_profiles (user_id) values ($1) on conflict do nothing'
      using caller_id;

    execute 'select ap.id from public.artist_profiles ap where ap.user_id = $1 limit 1'
      into artist_owner_id
      using caller_id;
  end if;

  if artist_owner_id is null then
    raise exception 'Could not resolve artist profile row for caller %', caller_id using errcode = '23503';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'songs'
      and column_name = 'genre_id'
  )
  into has_genre_id_column;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'songs'
      and column_name = 'genre'
  )
  into has_genre_column;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'songs'
      and column_name = 'created_at'
  )
  into has_created_at_column;

  if has_genre_id_column and p_genre_id is not null then
    cols := array_append(cols, 'genre_id');
    vals := array_append(vals, '$7');
  end if;

  if has_genre_column and p_genre is not null and length(trim(p_genre)) > 0 then
    cols := array_append(cols, 'genre');
    vals := array_append(vals, '$8');
  end if;

  if has_created_at_column then
    cols := array_append(cols, 'created_at');
    vals := array_append(vals, 'now()');
  end if;

  insert_sql := format(
    'insert into public.songs (%s) values (%s) returning id, title, status, artist_id, audio_url, cover_url, price',
    array_to_string(cols, ', '),
    array_to_string(vals, ', ')
  );

  execute insert_sql
    using artist_owner_id, p_title, p_description, p_price, p_audio_url, p_cover_url, p_genre_id, p_genre
    into song_row;

  return jsonb_build_object(
    'status', 'ok',
    'song', jsonb_build_object(
      'id', song_row.id,
      'title', song_row.title,
      'status', song_row.status,
      'artist_id', song_row.artist_id,
      'audio_url', song_row.audio_url,
      'cover_url', song_row.cover_url,
      'price', song_row.price
    )
  );
end;
$$;

revoke all on function public.create_pending_song_upload(text, text, uuid, text, numeric, text, text) from public;
grant execute on function public.create_pending_song_upload(text, text, uuid, text, numeric, text, text) to authenticated;
