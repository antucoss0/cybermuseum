// Stripe webhook (checkout.session.completed). Verified with STRIPE_WEBHOOK_SECRET when set.
import { readBody, send, verifyStripe } from './_lib.js'
export const config = { api: { bodyParser: false } }
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const raw = await readBody(req)
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (secret && !verifyStripe(raw, req.headers['stripe-signature'], secret)) return send(res, 400, { error: 'bad signature' })
  let ev = {}
  try {
    ev = JSON.parse(raw)
  } catch {}
  send(res, 200, { received: true, type: ev.type || null })
}
