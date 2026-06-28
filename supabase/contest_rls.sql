-- NextHit contest system RLS and safety constraints
-- Run in Supabase SQL editor.

-- Safety constraints
create unique index if not exists contest_entries_unique_song_per_contest
on public.contest_entries (contest_id, song_id);

create unique index if not exists contest_votes_unique_user_per_contest
on public.contest_votes (contest_id, user_id);

alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
alter table public.contest_votes enable row level security;

-- Helper expression used in policies:
-- exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)

-- Contests
drop policy if exists contests_public_read_live on public.contests;
create policy contests_public_read_live
on public.contests
for select
using (status in ('active', 'voting', 'closed'));

drop policy if exists contests_admin_manage on public.contests;
create policy contests_admin_manage
on public.contests
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- Contest entries
drop policy if exists contest_entries_public_read_live on public.contest_entries;
create policy contest_entries_public_read_live
on public.contest_entries
for select
using (
  exists (
    select 1
    from public.contests c
    where c.id = contest_entries.contest_id
      and c.status in ('active', 'voting', 'closed')
  )
);

drop policy if exists contest_entries_artist_insert_own on public.contest_entries;
create policy contest_entries_artist_insert_own
on public.contest_entries
for insert
with check (
  artist_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'artist' or p.is_admin = true)
  )
);

drop policy if exists contest_entries_artist_delete_own on public.contest_entries;
create policy contest_entries_artist_delete_own
on public.contest_entries
for delete
using (
  artist_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists contest_entries_admin_manage on public.contest_entries;
create policy contest_entries_admin_manage
on public.contest_entries
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- Contest votes
drop policy if exists contest_votes_public_read_live on public.contest_votes;
create policy contest_votes_public_read_live
on public.contest_votes
for select
using (
  exists (
    select 1
    from public.contests c
    where c.id = contest_votes.contest_id
      and c.status in ('active', 'voting', 'closed')
  )
);

drop policy if exists contest_votes_user_insert_once on public.contest_votes;
create policy contest_votes_user_insert_once
on public.contest_votes
for insert
with check (
  user_id = auth.uid()
);

drop policy if exists contest_votes_admin_manage on public.contest_votes;
create policy contest_votes_admin_manage
on public.contest_votes
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);
