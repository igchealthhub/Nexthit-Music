-- Fix Contest Manager permissions and RLS for public.contests
-- Safe to run multiple times without deleting data

alter table public.contests
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.contests enable row level security;

-- Ensure app roles can reach table privileges; RLS still controls row access.
grant usage on schema public to anon, authenticated;
grant select on public.contests to anon;
grant select, insert, update, delete on public.contests to authenticated;
grant select on public.profiles to authenticated;

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
