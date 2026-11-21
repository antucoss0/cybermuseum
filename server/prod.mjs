// Production server: serves the built museum from /dist and the pey API from /api on one origin.
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const root = new URL('../dist/', import.meta.url).pathname
const routes = ['health', 'checkout', 'status', 'transactions', 'feed', 'webhook', 'content', 'upload', 'submit']
const api = Object.fromEntries(await Promise.all(routes.map(async (r) => [r, (await import(`../api/${r}.js`)).default])))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.ply': 'application/octet-stream', '.json': 'application/json', '.mp4': 'video/mp4' }
http
  .createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const m = path.match(/\/api\/([a-z]+)\/?$/)
    if (m) {
      const fn = api[m[1]]
      if (!fn) return (res.statusCode = 404), res.end('{}')
      return Promise.resolve(fn(req, res)).catch((e) => ((res.statusCode = 500), res.end(JSON.stringify({ error: String(e) }))))
    }
    let file = normalize(join(root, path))
    if (!file.startsWith(root)) return (res.statusCode = 403), res.end()
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    } catch {
      file = join(root, 'index.html')
    }
    try {
      const body = await readFile(file)
      const ext = extname(file)
      res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
      res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable')
      res.end(body)
    } catch {
      res.statusCode = 404
      res.end('not found')
    }
  })
  .listen(Number(process.env.PORT || 4173), () => console.log('cyber museum on', process.env.PORT || 4173))
