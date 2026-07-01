-- Stripe Connect Phase 1 schema additions

alter table public.profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;

alter table public.purchases
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists platform_fee numeric(10,2),
  add column if not exists artist_amount numeric(10,2),
  add column if not exists affiliate_id text,
  add column if not exists affiliate_amount numeric(10,2);

create unique index if not exists purchases_stripe_checkout_session_id_uidx
  on public.purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
