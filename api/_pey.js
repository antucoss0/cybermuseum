// Server-only helpers. The pey API key never reaches the browser.
import crypto from 'node:crypto'

export const PEY_BASE = (process.env.PEY_API_BASE || 'https://api.pey.mx').replace(/\/$/, '')
export const configured = () => Boolean(process.env.PEY_API_KEY)
const ADMIN_PIN = () => process.env.ADMIN_PIN || '4444'

export async function pey(path, init = {}) {
  const r = await fetch(PEY_BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${process.env.PEY_API_KEY}`, ...(init.headers || {}) },
  })
  const text = await r.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!r.ok) {
    const err = new Error(data?.message || `pey ${r.status}`)
    err.status = r.status
    err.data = data
    throw err
  }
  return data
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pin')
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
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return JSON.stringify(req.body)
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

export const isAdmin = (req) => {
  const pin = String(req.headers['x-admin-pin'] || '')
  const want = ADMIN_PIN()
  return pin.length === want.length && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(want))
}

/** Standard Webhooks (https://www.standardwebhooks.com) signature check. */
export function verifyWebhook(raw, headers, secret) {
  const id = headers['webhook-id']
  const ts = headers['webhook-timestamp']
  const sigs = String(headers['webhook-signature'] || '')
  if (!id || !ts || !sigs) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64')
  return sigs.split(' ').some((s) => {
    const v = s.split(',')[1] || ''
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected))
  })
}
