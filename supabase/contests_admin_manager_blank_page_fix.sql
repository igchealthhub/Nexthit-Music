-- Fix admin contest manager schema drift and permissions.
-- Safe/idempotent. Run this whole block in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  prize_amount numeric default 0,
  start_date timestamptz,
  end_date timestamptz,
  status text not null default 'draft',
  cover_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contests
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists prize_amount numeric default 0,
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists status text not null default 'draft',
  add column if not exists cover_url text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.contests
set prize_amount = coalesce(prize_amount, 0)
where prize_amount is null;

update public.contests
set prize_amount = coalesce(prize_amount, nullif(regexp_replace(prize, '[^0-9.\-]', '', 'g'), '')::numeric, 0)
where prize_amount is null
  and prize is not null;

update public.contests
set status = 'completed'
where status in ('closed', 'archived');

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'contests_status_check'
      and conrelid = 'public.contests'::regclass
  ) then
    alter table public.contests drop constraint contests_status_check;
  end if;

  alter table public.contests
    add constraint contests_status_check
    check (status in ('draft', 'active', 'completed'));
end
$$;

create or replace function public.set_contests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contests_updated_at on public.contests;
create trigger trg_contests_updated_at
before update on public.contests
for each row execute function public.set_contests_updated_at();

alter table public.contests enable row level security;

drop policy if exists contests_public_read_active on public.contests;
create policy contests_public_read_active
on public.contests
for select
to public
using (status = 'active');

drop policy if exists contests_admin_read_all on public.contests;
create policy contests_admin_read_all
on public.contests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists contests_admin_insert on public.contests;
create policy contests_admin_insert
on public.contests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists contests_admin_update on public.contests;
create policy contests_admin_update
on public.contests
for update
to authenticated
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

drop policy if exists contests_admin_delete on public.contests;
create policy contests_admin_delete
on public.contests
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);
