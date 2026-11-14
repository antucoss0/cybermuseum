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
 * pey (CoDi) provider — placeholder for the hackathon integration.
 * The browser must never hold the pey API key: a small backend (see README)
 * calls POST https://api.pey.mx/codi/qr or /payment-link/create, receives the
 * `codi.qr.payment_received` / `payment_link.status_updated` webhooks
 * (Standard Webhooks signature) and relays them to clients.
 */
export class PeyProvider implements PaymentProvider {
  readonly name = 'pey · CoDi'
  constructor(private backend: string) {}
  async createCheckout(amount: number, concept: string, purpose: PaymentPurpose, payer: string): Promise<Checkout> {
    const r = await fetch(this.backend.replace(/\/$/, '') + '/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, concept, purpose, payer }),
    })
    if (!r.ok) throw new Error('No se pudo crear el cobro')
    const data = (await r.json()) as { id: string; qrString?: string; url?: string }
    return {
      id: data.id,
      amount,
      concept,
      qrString: data.qrString,
      url: data.url,
      simulated: false,
      wait: (signal) =>
        new Promise((resolve) => {
          const off = payments.received.on((p) => {
            if (p.concept.includes(data.id) || p.id === data.id) {
              off()
              resolve(p)
            }
          })
          signal.addEventListener('abort', () => {
            off()
            resolve(null)
          })
        }),
    }
  }
}

export function getProvider(): PaymentProvider {
  const backend = content.data.settings.peyBackend.trim()
  return backend ? new PeyProvider(backend) : new SimulatedProvider()
}
