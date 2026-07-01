import { requireArtistProfile, sendJson, stripe, supabaseAdmin } from './_lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  try {
    const ctx = await requireArtistProfile(req, res)
    if (!ctx) return

    if (ctx.profile.stripe_account_id) {
      return sendJson(res, 200, {
        stripeAccountId: ctx.profile.stripe_account_id,
        alreadyExists: true,
      })
    }

    const account = await stripe.accounts.create({
      type: 'express',
      metadata: {
        profile_id: ctx.profile.id,
        artist_profile_id: ctx.artistProfile.id,
      },
    })

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
      })
      .eq('id', ctx.profile.id)

    if (error) {
      return sendJson(res, 500, { error: error.message })
    }

    return sendJson(res, 200, { stripeAccountId: account.id, alreadyExists: false })
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'Unable to create Stripe account.' })
  }
}
