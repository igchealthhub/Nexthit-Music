-- Ensure contests schema supports Admin Manage Contests page
-- Safe to run multiple times

alter table public.contests
  add column if not exists prize_amount numeric(10,2) not null default 0,
  add column if not exists cover_url text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Keep legacy prize text in sync where possible
update public.contests
set prize_amount = coalesce(nullif(regexp_replace(coalesce(prize, ''), '[^0-9.\-]', '', 'g'), '')::numeric, 0)
where prize_amount is null
   or prize_amount = 0;

-- Normalize status values expected by UI
update public.contests
set status = 'completed'
where lower(coalesce(status, '')) in ('closed', 'archived');

alter table public.contests
  drop constraint if exists contests_status_check;

alter table public.contests
  add constraint contests_status_check
  check (status in ('draft', 'active', 'completed'));

-- Trigger to auto-update updated_at
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

drop policy if exists contests_admin_manage_all on public.contests;
create policy contests_admin_manage_all
on public.contests
for all
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

drop policy if exists contests_public_read on public.contests;
create policy contests_public_read
on public.contests
for select
to public
using (status = 'active');
