import { readRawBody, sendJson, stripe, supabaseAdmin } from './_lib/server.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  const signature = req.headers['stripe-signature']
  if (!signature) return sendJson(res, 400, { error: 'Missing Stripe signature.' })

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return sendJson(res, 500, { error: 'Missing STRIPE_SECRET_KEY.' })
    }

    const raw = await readRawBody(req)
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return sendJson(res, 500, { error: 'Missing STRIPE_WEBHOOK_SECRET.' })

    const event = stripe.webhooks.constructEvent(raw, signature, secret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const metadata = session.metadata || {}

      if (session.payment_status !== 'paid') {
        return sendJson(res, 200, { received: true, ignored: 'payment_not_paid' })
      }

      if (!metadata.buyer_id || !metadata.song_id) {
        return sendJson(res, 200, { received: true, ignored: 'missing_metadata' })
      }

      const payload = {
        buyer_id: metadata.buyer_id,
        song_id: metadata.song_id,
        artist_id: metadata.artist_id || null,
        amount: Number(metadata.amount || 0) / 100,
        platform_fee: Number(metadata.platform_fee || 0) / 100,
        artist_amount: Number(metadata.artist_amount || 0) / 100,
        affiliate_id: metadata.affiliate_id || null,
        affiliate_amount: Number(metadata.affiliate_amount || 0) / 100,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: String(session.payment_intent || ''),
        status: 'completed',
      }

      const upsertResult = await supabaseAdmin
        .from('purchases')
        .upsert(payload, { onConflict: 'buyer_id,song_id' })

      if (upsertResult.error) {
        throw upsertResult.error
      }
    }

    return sendJson(res, 200, { received: true })
  } catch (error) {
    return sendJson(res, 400, { error: error?.message || 'Webhook error.' })
  }
}
