import { parseJsonBody, requireArtistProfile, sendJson, siteUrl, stripe } from '../_lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  try {
    const ctx = await requireArtistProfile(req, res)
    if (!ctx) return
    const body = await parseJsonBody(req)

    if (!ctx.profile.stripe_account_id) {
      return sendJson(res, 400, { error: 'No Stripe account connected yet.' })
    }

    const base = siteUrl(req)
    const link = await stripe.accountLinks.create({
      account: ctx.profile.stripe_account_id,
      refresh_url: `${base}/artist-dashboard?stripe=refresh`,
      return_url: `${base}/artist-dashboard?stripe=return`,
      type: 'account_onboarding',
    })

    if (body?.redirect === true) {
      res.statusCode = 303
      res.setHeader('Location', link.url)
      res.end()
      return
    }

    return sendJson(res, 200, { url: link.url })
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'Unable to create onboarding link.' })
  }
}
