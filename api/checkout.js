// POST { amount, concept, purpose, payer } -> Stripe Checkout Session URL
import { cors, origin, readBody, send, stripe, stripeOn } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  if (!stripeOn()) return send(res, 503, { error: 'stripe not configured' })
  try {
    const b = JSON.parse((await readBody(req)) || '{}')
    const amount = Math.round(Number(b.amount) * 100) / 100
    if (!(amount >= 10 && amount <= 100000)) return send(res, 400, { error: 'amount out of range' })
    const concept = String(b.concept || 'Cyber Museum').slice(0, 120)
    const meta = { app: 'cyber-museum', purpose: ['donacion', 'tienda', 'jardin', 'entrada'].includes(b.purpose) ? b.purpose : 'donacion', payer: String(b.payer || '').slice(0, 40) }
    const base = origin(req)
    const s = await stripe('/checkout/sessions', {
      mode: 'payment',
      line_items: { 0: { quantity: 1, price_data: { currency: (process.env.STRIPE_CURRENCY || 'mxn').toLowerCase(), unit_amount: Math.round(amount * 100), product_data: { name: concept } } } },
      success_url: `${base}/?paid={CHECKOUT_SESSION_ID}#/museo`,
      cancel_url: `${base}/#/museo`,
      metadata: meta,
      payment_intent_data: { metadata: meta },
    })
    send(res, 200, { id: s.id, url: s.url, amount, concept })
  } catch (e) {
    send(res, e.status || 500, { error: String(e.message || e) })
  }
}
