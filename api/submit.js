// Open-call applications: POST (public) stores one JSON per application; GET (admin PIN) lists them.
import { blobOn, cors, isAdmin, readBody, send } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!blobOn()) return send(res, 503, { error: 'storage not configured' })
  const { list, put } = await import('@vercel/blob')
  try {
    if (req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}')
      const clip = (v, n) => String(v || '').slice(0, n)
      const sub = { id: clip(b.id, 40).replace(/[^\w-]/g, '') || 's' + Date.now().toString(36), name: clip(b.name, 60), email: clip(b.email, 80), title: clip(b.title, 100), link: /^https?:\/\//i.test(String(b.link || '')) ? clip(b.link, 200) : '', message: clip(b.message, 1500), callId: clip(b.callId, 40), at: Date.now(), status: 'pendiente' }
      if (!sub.name || !/^\S+@\S+\.\S+$/.test(sub.email) || !sub.title) return send(res, 400, { error: 'missing fields' })
      await put(`submissions/${sub.id}.json`, JSON.stringify(sub), { access: 'public', addRandomSuffix: true, contentType: 'application/json' })
      return send(res, 200, { ok: true })
    }
    if (!isAdmin(req)) return send(res, 401, { error: 'admin pin required' })
    if (req.method === 'DELETE') {
      const id = new URL(req.url, 'http://x').searchParams.get('id') || ''
      const { del } = await import('@vercel/blob')
      const { blobs: hit } = await list({ prefix: `submissions/${id.replace(/[^\w-]/g, '')}` })
      if (hit.length) await del(hit.map((x) => x.url))
      return send(res, 200, { ok: true, removed: hit.length })
    }
    const { blobs } = await list({ prefix: 'submissions/', limit: 500 })
    const items = await Promise.all(blobs.map((b) => fetch(b.url).then((r) => r.json()).catch(() => null)))
    send(res, 200, { items: items.filter(Boolean) })
  } catch (e) {
    send(res, 500, { error: String(e.message || e) })
  }
}
