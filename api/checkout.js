import { configured, cors, pey, readBody, send } from './_pey.js'

// POST { amount, concept, purpose, payer } -> CoDi QR via pey
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  if (!configured()) return send(res, 503, { error: 'pey not configured' })
  try {
    const b = JSON.parse((await readBody(req)) || '{}')
    const amount = Math.round(Number(b.amount) * 100) / 100
    if (!(amount > 0) || amount > 100000) return send(res, 400, { error: 'invalid amount' })
    const concept = String(b.concept || 'Cyber Museum').slice(0, 38)
    const numRef = String(Math.floor(Math.random() * 9_000_000) + 1_000_000)
    const qr = await pey('/codi/qr', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        concept,
        numRef,
        expiration: 900,
        metadata: { app: 'cyber-museum', purpose: String(b.purpose || 'donacion').slice(0, 20), payer: String(b.payer || '').slice(0, 40) },
      }),
    })
    send(res, 200, { id: qr.id, qrString: qr.qrString, amount, concept, numRef })
  } catch (e) {
    send(res, e.status && e.status < 500 ? 400 : 502, { error: e.message, detail: e.data })
  }
}
