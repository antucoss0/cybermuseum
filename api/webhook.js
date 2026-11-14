import { cors, readBody, send, verifyWebhook } from './_pey.js'

// pey webhooks: codi.qr.payment_received, codi.pn.payment_received, payment_link.status_updated.
// Clients confirm by polling /api/status, so this endpoint only verifies and acknowledges.
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const raw = await readBody(req)
  const secret = process.env.PEY_WEBHOOK_SECRET
  if (secret && !verifyWebhook(raw, req.headers, secret)) return send(res, 401, { error: 'bad signature' })
  let evt = {}
  try {
    evt = JSON.parse(raw)
  } catch {}
  console.log('[pey webhook]', req.headers['webhook-id'], evt.type, evt.amount ?? '', evt.transactionId ?? evt.paymentLinkId ?? '')
  send(res, 200, { received: true })
}
