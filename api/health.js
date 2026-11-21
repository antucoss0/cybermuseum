import { blobOn, cors, send, stripeOn } from './_lib.js'
export default function handler(req, res) {
  if (cors(req, res)) return
  send(res, 200, { ok: true, stripe: stripeOn(), storage: blobOn(), provider: stripeOn() ? 'stripe' : 'demo' })
}
