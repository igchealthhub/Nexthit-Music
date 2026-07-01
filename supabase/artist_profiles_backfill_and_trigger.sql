-- NextHit artist profile repair + auto-bootstrap
-- Run in Supabase SQL editor.
-- Purpose:
-- 1) Repair existing artist users missing artist_profiles rows.
-- 2) Automatically create artist_profiles rows when profiles.role becomes 'artist'.

create table if not exists public.artist_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on table public.artist_profiles to authenticated;
grant select on table public.artist_profiles to anon;

alter table public.artist_profiles enable row level security;

drop policy if exists artist_profiles_public_read on public.artist_profiles;
create policy artist_profiles_public_read
on public.artist_profiles
for select
using (true);

drop policy if exists artist_profiles_owner_insert on public.artist_profiles;
create policy artist_profiles_owner_insert
on public.artist_profiles
for insert
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists artist_profiles_owner_update on public.artist_profiles;
create policy artist_profiles_owner_update
on public.artist_profiles
for update
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

create or replace function public.set_artist_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_artist_profiles_updated_at on public.artist_profiles;
create trigger trg_artist_profiles_updated_at
before update on public.artist_profiles
for each row execute function public.set_artist_profiles_updated_at();

create or replace function public.ensure_artist_profile_for_profile_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.role, '')) = 'artist' then
    insert into public.artist_profiles (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_ensure_artist_profile on public.profiles;
create trigger trg_profiles_ensure_artist_profile
after insert or update of role on public.profiles
for each row execute function public.ensure_artist_profile_for_profile_row();

insert into public.artist_profiles (id)
select p.id
from public.profiles p
left join public.artist_profiles ap on ap.id = p.id
where lower(coalesce(p.role, '')) = 'artist'
  and ap.id is null;
