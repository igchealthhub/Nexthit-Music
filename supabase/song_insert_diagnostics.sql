-- Song insert diagnostics helper
-- Run in Supabase SQL editor.

create or replace function public.song_insert_diagnostics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fk_target text := 'unknown';
  rls_enabled boolean := false;
  policy_names text[] := '{}';
begin
  select coalesce(
    string_agg(
      format('%I.%I -> %I.%I', kcu.table_name, kcu.column_name, ccu.table_name, ccu.column_name),
      ', '
    ),
    'none'
  )
  into fk_target
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name = 'songs'
    and kcu.column_name = 'artist_id';

  select c.relrowsecurity
  into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'songs';

  select coalesce(array_agg(policyname order by policyname), '{}')
  into policy_names
  from pg_policies
  where schemaname = 'public'
    and tablename = 'songs';

  return jsonb_build_object(
    'songs_artist_fk_target', fk_target,
    'songs_rls_enabled', coalesce(rls_enabled, false),
    'songs_policies', policy_names
  );
end;
$$;

revoke all on function public.song_insert_diagnostics() from public;
grant execute on function public.song_insert_diagnostics() to authenticated;
