-- Admin system tools: clean test data
-- Run in Supabase SQL Editor.
-- Adds RPC function used by /admin/system-tools button.

create or replace function public.admin_clean_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_id uuid := auth.uid();
  has_admin_access boolean := false;
  test_user_ids uuid[] := '{}';
  test_contest_ids uuid[] := '{}';
  users_deleted integer := 0;
  profiles_deleted integer := 0;
  artist_profiles_deleted integer := 0;
  songs_deleted integer := 0;
  notifications_deleted integer := 0;
  contests_deleted integer := 0;
  purchases_deleted integer := 0;
  contest_entries_deleted integer := 0;
  contest_votes_deleted integer := 0;
begin
  select exists (
    select 1
    from public.profiles p
    where p.id = requester_id
      and p.is_admin = true
  )
  into has_admin_access;

  if not has_admin_access then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  select coalesce(array_agg(u.id), '{}')
  into test_user_ids
  from auth.users u
  where u.email ilike '%@nexthit.test';

  if coalesce(array_length(test_user_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'ok',
      'message', 'No @nexthit.test users found.',
      'users_deleted', 0,
      'profiles_deleted', 0,
      'artist_profiles_deleted', 0,
      'songs_deleted', 0,
      'notifications_deleted', 0,
      'contests_deleted', 0,
      'purchases_deleted', 0,
      'contest_entries_deleted', 0,
      'contest_votes_deleted', 0
    );
  end if;

  if to_regclass('public.contests') is not null then
    execute 'select coalesce(array_agg(id), ''{}'') from public.contests where created_by = any($1)'
      into test_contest_ids
      using test_user_ids;
  end if;

  if to_regclass('public.contest_votes') is not null then
    execute 'delete from public.contest_votes where user_id = any($1)'
      using test_user_ids;
    get diagnostics contest_votes_deleted = row_count;

    if coalesce(array_length(test_contest_ids, 1), 0) > 0 then
      execute 'delete from public.contest_votes where contest_id = any($1)'
        using test_contest_ids;
      get diagnostics contest_votes_deleted = contest_votes_deleted + row_count;
    end if;
  end if;

  if to_regclass('public.contest_entries') is not null then
    execute 'delete from public.contest_entries where artist_id = any($1) or user_id = any($1)'
      using test_user_ids;
    get diagnostics contest_entries_deleted = row_count;

    if coalesce(array_length(test_contest_ids, 1), 0) > 0 then
      execute 'delete from public.contest_entries where contest_id = any($1)'
        using test_contest_ids;
      get diagnostics contest_entries_deleted = contest_entries_deleted + row_count;
    end if;
  end if;

  if to_regclass('public.purchases') is not null then
    execute 'delete from public.purchases where buyer_id = any($1) or artist_id = any($1)'
      using test_user_ids;
    get diagnostics purchases_deleted = row_count;
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications where user_id = any($1)'
      using test_user_ids;
    get diagnostics notifications_deleted = row_count;
  end if;

  if to_regclass('public.songs') is not null then
    execute 'delete from public.songs where artist_id = any($1)'
      using test_user_ids;
    get diagnostics songs_deleted = row_count;
  end if;

  if to_regclass('public.contests') is not null then
    execute 'delete from public.contests where created_by = any($1)'
      using test_user_ids;
    get diagnostics contests_deleted = row_count;
  end if;

  if to_regclass('public.artist_profiles') is not null then
    execute 'delete from public.artist_profiles where id = any($1)'
      using test_user_ids;
    get diagnostics artist_profiles_deleted = row_count;
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where id = any($1)'
      using test_user_ids;
    get diagnostics profiles_deleted = row_count;
  end if;

  execute 'delete from auth.users where id = any($1)'
    using test_user_ids;
  get diagnostics users_deleted = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'users_deleted', users_deleted,
    'profiles_deleted', profiles_deleted,
    'artist_profiles_deleted', artist_profiles_deleted,
    'songs_deleted', songs_deleted,
    'notifications_deleted', notifications_deleted,
    'contests_deleted', contests_deleted,
    'purchases_deleted', purchases_deleted,
    'contest_entries_deleted', contest_entries_deleted,
    'contest_votes_deleted', contest_votes_deleted
  );
end;
$$;

revoke all on function public.admin_clean_test_data() from public;
grant execute on function public.admin_clean_test_data() to authenticated;
