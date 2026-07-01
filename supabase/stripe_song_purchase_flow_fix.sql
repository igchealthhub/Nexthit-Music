-- Stripe song purchase flow hardening
-- Safe to run multiple times

alter table public.purchases
  add column if not exists buyer_id uuid references auth.users(id) on delete set null,
  add column if not exists song_id uuid references public.songs(id) on delete set null,
  add column if not exists artist_id uuid references auth.users(id) on delete set null,
  add column if not exists amount numeric(10,2),
  add column if not exists status text not null default 'completed',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists platform_fee numeric(10,2),
  add column if not exists artist_amount numeric(10,2),
  add column if not exists affiliate_id text,
  add column if not exists affiliate_amount numeric(10,2),
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists purchases_buyer_song_uidx
  on public.purchases (buyer_id, song_id)
  where buyer_id is not null and song_id is not null;

create unique index if not exists purchases_stripe_checkout_session_id_uidx
  on public.purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.purchases enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.purchases to authenticated;
grant insert on public.purchases to authenticated;

drop policy if exists purchases_buyer_read_own on public.purchases;
create policy purchases_buyer_read_own
on public.purchases
for select
to authenticated
using (buyer_id = auth.uid());
