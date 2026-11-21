// Revenue (PIN 4441): completed Checkout Sessions.
import { cors, isRevenue, send, stripe, stripeOn } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!isRevenue(req)) return send(res, 401, { error: 'revenue pin required' })
  if (!stripeOn()) return send(res, 503, { error: 'stripe not configured' })
  try {
    const r = await stripe('/checkout/sessions?limit=100&status=complete')
    send(res, 200, { items: r.data.map((s) => ({ id: s.id, amount: s.amount_total / 100, currency: s.currency, purpose: s.metadata?.purpose, payer: s.metadata?.payer, email: s.customer_details?.email, at: s.created * 1000 })) })
  } catch (e) {
    send(res, e.status || 500, { error: String(e.message || e) })
  }
}
