// Client uploads straight to Vercel Blob (any size / format). Token only issued with the admin PIN.
import { blobOn, checkPin, cors, readBody, send } from './_lib.js'
export default async function handler(req, res) {
  if (cors(req, res)) return
  if (!blobOn()) return send(res, 503, { error: 'storage not configured' })
  const { handleUpload } = await import('@vercel/blob/client')
  try {
    const body = JSON.parse((await readBody(req)) || '{}')
    const out = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_path, payload) => {
        if (!checkPin(JSON.parse(payload || '{}').pin)) throw new Error('admin pin required')
        return { addRandomSuffix: true, maximumSizeInBytes: 500 * 1024 * 1024 }
      },
      onUploadCompleted: async () => {},
    })
    send(res, 200, out)
  } catch (e) {
    send(res, 400, { error: String(e.message || e) })
  }
}
