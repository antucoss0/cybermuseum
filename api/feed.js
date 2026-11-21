// Public, anonymised feed of recent payments so every visitor sees the garden grow.
import { cors, send, stripe, stripeOn } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!stripeOn()) return send(res, 200, { items: [] })
  try {
    const r = await stripe('/checkout/sessions?limit=40&status=complete')
    send(res, 200, { items: r.data.filter((s) => s.metadata?.app === 'cyber-museum').map((s) => ({ id: 'stripe_' + s.id, amount: s.amount_total / 100, payer: (s.metadata?.payer || '').slice(0, 24), purpose: s.metadata?.purpose || 'donacion', at: s.created * 1000 })) })
  } catch (e) {
    send(res, 200, { items: [], error: String(e.message || e) })
  }
}
