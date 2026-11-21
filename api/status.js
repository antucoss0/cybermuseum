// GET ?id=cs_... -> { paid, amount, payer, concept }
import { cors, send, stripe, stripeOn } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!stripeOn()) return send(res, 503, { error: 'stripe not configured' })
  const id = new URL(req.url, 'http://x').searchParams.get('id') || ''
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return send(res, 400, { error: 'bad id' })
  try {
    const s = await stripe(`/checkout/sessions/${id}`)
    const paid = s.payment_status === 'paid'
    send(res, 200, paid ? { paid, amount: s.amount_total / 100, payer: s.metadata?.payer || '', purpose: s.metadata?.purpose || 'donacion', at: s.created * 1000 } : { paid: false })
  } catch (e) {
    send(res, e.status || 500, { error: String(e.message || e) })
  }
}
