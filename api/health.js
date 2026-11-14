import { configured, cors, send } from './_pey.js'
export default function handler(req, res) {
  if (cors(req, res)) return
  send(res, 200, { ok: true, pey: configured(), provider: configured() ? 'pey · CoDi' : 'simulated' })
}
