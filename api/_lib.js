// Server-only helpers. Stripe and Blob secrets never reach the browser.
import crypto from 'node:crypto'

export const stripeOn = () => Boolean(process.env.STRIPE_SECRET_KEY)
export const blobOn = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const ADMIN_PIN = () => process.env.ADMIN_PIN || '4444'
const REVENUE_PIN = () => process.env.REVENUE_PIN || '4441'

/** Minimal Stripe REST client (form-encoded, no SDK). */
export async function stripe(path, params, method = params ? 'POST' : 'GET') {
  const enc = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) => {
      const key = p ? `${p}[${k}]` : k
      return v && typeof v === 'object' ? enc(v, key) : v === undefined ? [] : [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`]
    })
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? enc(params).join('&') : undefined,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data?.error?.message || `stripe ${r.status}`)
    err.status = r.status
    throw err
  }
  return data
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pin, x-revenue-pin')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function cors(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return true
  }
  return false
}

export async function readBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body)
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
export const isAdmin = (req) => same(String(req.headers['x-admin-pin'] || ''), ADMIN_PIN())
export const isRevenue = (req) => same(String(req.headers['x-revenue-pin'] || ''), REVENUE_PIN())
export const checkPin = (pin) => same(String(pin || ''), ADMIN_PIN())

/** Stripe-Signature header check (t=…,v1=…), 5 min tolerance. */
export function verifyStripe(raw, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')))
  if (!parts.t || !parts.v1) return false
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex')
  return String(header).split(',').some((p) => p.startsWith('v1=') && same(p.slice(3), expected))
}

export const origin = (req) => process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`
