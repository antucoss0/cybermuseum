// POST { pin, kind: 'admin' | 'revenue' } -> 200 when the PIN matches the server-side PIN, else 401.
import { cors, isAdmin, isRevenue, readBody, send } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const b = JSON.parse((await readBody(req)) || '{}')
  const ok = b.kind === 'revenue' ? isRevenue({ headers: { 'x-revenue-pin': b.pin } }) : isAdmin({ headers: { 'x-admin-pin': b.pin } })
  send(res, ok ? 200 : 401, { ok })
}
