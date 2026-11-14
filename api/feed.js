import { configured, cors, pey, send } from './_pey.js'

// GET -> recent paid transactions (public, anonymised) so every visitor sees real payments
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!configured()) return send(res, 200, { items: [] })
  try {
    const r = await pey('/transaction/api-key')
    const items = (r.items || [])
      .filter((t) => t.status === 'PAID')
      .slice(0, 30)
      .map((t) => ({ id: t.id, amount: t.amount, concept: t.description || 'CoDi', at: (t.datePaid || t.dateCreated || 0) * 1000 }))
    send(res, 200, { items })
  } catch (e) {
    send(res, 502, { error: e.message })
  }
}
