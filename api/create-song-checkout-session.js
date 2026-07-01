import { parseJsonBody, requireUser, sendJson, siteUrl, stripe, supabaseAdmin } from './_lib/server.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return sendJson(res, 500, { error: 'Missing STRIPE_SECRET_KEY.' })
    }

    const user = await requireUser(req, res)
    if (!user) return

    const body = await parseJsonBody(req)
    const songId = body?.songId

    if (!songId) return sendJson(res, 400, { error: 'songId is required.' })

    const { data: song, error: songError } = await supabaseAdmin
      .from('songs')
      .select('id, title, price, artist_id, status')
      .eq('id', songId)
      .maybeSingle()

    if (songError || !song) return sendJson(res, 404, { error: songError?.message || 'Song not found.' })
    if ((song.status || '').toLowerCase() !== 'approved') return sendJson(res, 400, { error: 'Song is not available for purchase.' })

    const { data: existingPurchase, error: purchaseLookupError } = await supabaseAdmin
      .from('purchases')
      .select('id, buyer_id, song_id, status')
      .eq('buyer_id', user.id)
      .eq('song_id', song.id)
      .maybeSingle()

    if (purchaseLookupError) {
      return sendJson(res, 500, { error: purchaseLookupError.message })
    }

    if (existingPurchase) {
      return sendJson(res, 200, {
        alreadyPurchased: true,
        message: 'Song already purchased.',
      })
    }

    const amount = Math.max(0, Math.round(Number(song.price || 0) * 100))
    if (amount <= 0) return sendJson(res, 400, { error: 'This song is free and does not require checkout.' })

    const platformFee = Math.round(amount * 0.15)
    const artistAmount = amount - platformFee
    const base = siteUrl(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: {
              name: song.title || 'NextHit Song',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/songs?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/songs?checkout=cancel`,
      metadata: {
        buyer_id: user.id,
        song_id: song.id,
        artist_id: String(song.artist_id || ''),
        amount: String(amount),
        platform_fee: String(platformFee),
        artist_amount: String(artistAmount),
        affiliate_id: '',
        affiliate_amount: '0',
      },
      customer_email: user.email || undefined,
    })

    return sendJson(res, 200, {
      url: session.url,
      id: session.id,
    })
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'Unable to create checkout session.' })
  }
}
