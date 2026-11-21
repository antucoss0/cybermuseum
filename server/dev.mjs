// Local API server mirroring the Vercel functions in /api (used by `npm run api`).
import http from 'node:http'
const routes = ['health', 'checkout', 'status', 'transactions', 'feed', 'webhook', 'content', 'upload', 'submit']
const mods = Object.fromEntries(await Promise.all(routes.map(async (r) => [r, (await import(`../api/${r}.js`)).default])))
http
  .createServer((req, res) => {
    const name = new URL(req.url, 'http://x').pathname.replace(/^\/api\//, '').replace(/\/$/, '')
    const fn = mods[name]
    if (!fn) return (res.statusCode = 404), res.end('{}')
    Promise.resolve(fn(req, res)).catch((e) => ((res.statusCode = 500), res.end(JSON.stringify({ error: String(e) }))))
  })
  .listen(Number(process.env.API_PORT || 8787), () => console.log('api on', process.env.API_PORT || 8787))
