import { configured, cors, isAdmin, pey, send } from './_pey.js'

// GET (x-admin-pin) -> latest pey transactions of the API key, for the SuperAdmin revenue charts
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' })
  if (!configured()) return send(res, 200, { pey: false, items: [] })
  try {
    const r = await pey('/transaction/api-key')
    send(res, 200, { pey: true, items: r.items || [] })
  } catch (e) {
    send(res, 502, { error: e.message })
  }
}
