// Shared museum content: GET (public) / PUT (admin PIN). Stored as one JSON document in Vercel Blob.
import { blobOn, cors, isAdmin, readBody, send } from './_lib.js'
const PATH = 'content/museum.json'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!blobOn()) return send(res, 503, { error: 'storage not configured' })
  const { head, put } = await import('@vercel/blob')
  try {
    if (req.method === 'GET') {
      const meta = await head(PATH).catch(() => null)
      if (!meta) return send(res, 404, { error: 'empty' })
      const r = await fetch(`${meta.url}?v=${Date.parse(meta.uploadedAt) || Date.now()}`, { cache: 'no-store' })
      return send(res, 200, { content: await r.json(), at: meta.uploadedAt })
    }
    if (req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { error: 'admin pin required' })
      const body = await readBody(req)
      JSON.parse(body)
      const b = await put(PATH, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 })
      return send(res, 200, { ok: true, url: b.url })
    }
    send(res, 405, { error: 'GET or PUT' })
  } catch (e) {
    send(res, 500, { error: String(e.message || e) })
  }
}
