import { requireArtistProfile, sendJson, stripe, supabaseAdmin } from './_lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  try {
    const ctx = await requireArtistProfile(req, res)
    if (!ctx) return

    if (!ctx.profile.stripe_account_id) {
      return sendJson(res, 200, {
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      })
    }

    const account = await stripe.accounts.retrieve(ctx.profile.stripe_account_id)

    const onboardingComplete = account.details_submitted === true
    const chargesEnabled = account.charges_enabled === true
    const payoutsEnabled = account.payouts_enabled === true

    await supabaseAdmin
      .from('profiles')
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq('id', ctx.profile.id)

    return sendJson(res, 200, {
      connected: true,
      stripeAccountId: ctx.profile.stripe_account_id,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
    })
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'Unable to fetch Stripe status.' })
  }
}
