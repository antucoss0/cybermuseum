import { content } from '../content/store'
import { payments, type PaymentEvent, type PaymentPurpose } from './bus'

/**
 * A checkout the UI can show: a CoDi QR string (rendered client-side),
 * and/or a hosted payment-link URL. `wait()` resolves when the payment lands.
 */
export interface Checkout {
  id: string
  amount: number
  concept: string
  qrString?: string
  url?: string
  simulated: boolean
  wait(signal: AbortSignal): Promise<PaymentEvent | null>
  /** Only for simulated checkouts: completes the payment locally. */
  simulate?(): PaymentEvent
}

export interface PaymentProvider {
  readonly name: string
  createCheckout(amount: number, concept: string, purpose: PaymentPurpose, payer: string): Promise<Checkout>
}

/** Offline provider used until the pey integration is connected. */
export class SimulatedProvider implements PaymentProvider {
  readonly name = 'Simulado'
  async createCheckout(amount: number, concept: string, purpose: PaymentPurpose, payer: string): Promise<Checkout> {
    const id = 'sim_' + Math.random().toString(36).slice(2, 10)
    let resolve: (p: PaymentEvent | null) => void = () => {}
    const done = new Promise<PaymentEvent | null>((r) => (resolve = r))
    return {
      id,
      amount,
      concept,
      simulated: true,
      qrString: JSON.stringify({ TYP: 'CYBERMUSEUM-DEMO', amount, concept, ref: id }),
      wait: (signal) => {
        signal.addEventListener('abort', () => resolve(null))
        return done
      },
      simulate: () => {
        const ev = payments.make(amount, concept, purpose, payer, 'sim')
        resolve(ev)
        return ev
      },
    }
  }
}

/**
 * pey (CoDi) provider. The browser never holds the pey API key: the serverless
 * backend in /api creates the CoDi QR (POST api.pey.mx/codi/qr) and the client
 * polls /api/status until pey reports the QR as PAID.
 */
export class PeyProvider implements PaymentProvider {
  readonly name = 'pey · CoDi'
  constructor(private backend: string) {}
  private url(path: string) {
    return this.backend.replace(/\/$/, '') + path
  }
  async createCheckout(amount: number, concept: string, purpose: PaymentPurpose, payer: string): Promise<Checkout> {
    const r = await fetch(this.url('/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, concept, purpose, payer }),
    })
    const data = (await r.json().catch(() => ({}))) as { id: string; qrString?: string; url?: string; error?: string }
    if (!r.ok || !data.id) throw new Error(data.error || 'pey checkout failed')
    return {
      id: data.id,
      amount,
      concept,
      qrString: data.qrString,
      url: data.url,
      simulated: false,
      wait: (signal) =>
        new Promise((resolve) => {
          let timer = 0
          const finish = (p: PaymentEvent | null) => {
            clearTimeout(timer)
            off()
            resolve(p)
          }
          const off = payments.received.on((p) => p.id === 'pey_' + data.id && finish(p))
          const poll = async () => {
            if (signal.aborted) return
            try {
              const s = await (await fetch(this.url('/status?id=' + encodeURIComponent(data.id)), { cache: 'no-store' })).json()
              if (s.paid) {
                const ev = payments.make(Number(s.amount) || amount, concept, purpose, payer, 'pey')
                ev.id = 'pey_' + data.id
                return finish(ev)
              }
            } catch {}
            timer = window.setTimeout(poll, 2500)
          }
          timer = window.setTimeout(poll, 2500)
          signal.addEventListener('abort', () => finish(null))
        }),
    }
  }
}

let detected: Promise<string> | null = null
/** Finds a configured pey backend: settings.peyBackend, or the same-origin /api functions. */
export function detectBackend(): Promise<string> {
  const manual = content.data.settings.peyBackend.trim()
  if (manual) return Promise.resolve(manual)
  detected ??= fetch('./api/health', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j?.pey ? './api' : ''))
    .catch(() => '')
  return detected
}

export async function getProvider(): Promise<PaymentProvider> {
  const backend = await detectBackend()
  return backend ? new PeyProvider(backend) : new SimulatedProvider()
}
