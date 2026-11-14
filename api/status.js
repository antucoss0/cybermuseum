import { configured, cors, pey, send } from './_pey.js'

// GET ?id=<codiQrId> -> { paid, amount, transactionId, datePaid }
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!configured()) return send(res, 503, { error: 'pey not configured' })
  const id = new URL(req.url, 'http://x').searchParams.get('id')
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) return send(res, 400, { error: 'invalid id' })
  try {
    const r = await pey(`/transaction/codi/qr/${encodeURIComponent(id)}`)
    const paid = (r.items || []).find((t) => t.status === 'PAID')
    send(res, 200, paid ? { paid: true, amount: paid.amount, transactionId: paid.id, datePaid: paid.datePaid } : { paid: false })
  } catch (e) {
    if (e.status === 404) return send(res, 200, { paid: false })
    send(res, 502, { error: e.message })
  }
}
