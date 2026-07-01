import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL)')
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)')
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
})

export function siteUrl(req) {
  return process.env.VITE_SITE_URL || `https://${req.headers.host}`
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function getBearerToken(req) {
  const header = req.headers.authorization || ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  return header.slice(7).trim()
}

export async function requireUser(req, res) {
  const token = getBearerToken(req)
  if (!token) {
    sendJson(res, 401, { error: 'Missing bearer token.' })
    return null
  }

  const { data, error } = await supabaseAnon.auth.getUser(token)
  if (error || !data?.user) {
    sendJson(res, 401, { error: error?.message || 'Invalid auth token.' })
    return null
  }

  return data.user
}

export async function requireArtistProfile(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_admin, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile) {
    sendJson(res, 403, { error: error?.message || 'Profile not found.' })
    return null
  }

  if (profile.role !== 'artist' && profile.is_admin !== true) {
    sendJson(res, 403, { error: 'Artist account required.' })
    return null
  }

  const { data: artistProfile, error: artistError } = await supabaseAdmin
    .from('artist_profiles')
    .select('id, user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (artistError || !artistProfile) {
    sendJson(res, 403, { error: artistError?.message || 'artist_profiles row not found for user.' })
    return null
  }

  return { user, profile, artistProfile }
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return await new Promise(resolve => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
  })
}

export async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body))

  return await new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
