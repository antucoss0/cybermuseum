import { payments, type PaymentEvent, type PaymentPurpose } from './bus'

/**
 * A checkout the UI can show: a hosted Stripe Checkout URL (or a demo QR). `wait()` resolves when the payment lands.
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

/** Offline demo provider used until STRIPE_SECRET_KEY is configured on the server. */
export class SimulatedProvider implements PaymentProvider {
  readonly name = 'Demo'
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
 * Stripe provider. The secret key lives only in the /api functions: the browser gets a hosted
 * Checkout URL, opens it, and polls /api/status until the session is paid.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = 'Stripe'
  async createCheckout(amount: number, concept: string, purpose: PaymentPurpose, payer: string): Promise<Checkout> {
    const r = await fetch('./api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, concept, purpose, payer }) })
    const data = (await r.json().catch(() => ({}))) as { id: string; url?: string; error?: string }
    if (!r.ok || !data.id) throw new Error(data.error || 'checkout failed')
    return {
      id: data.id,
      amount,
      concept,
      url: data.url,
      simulated: false,
      wait: (signal) =>
        new Promise((resolve) => {
          let timer = 0
          const finish = (p: PaymentEvent | null) => (clearTimeout(timer), resolve(p))
          const poll = async () => {
            if (signal.aborted) return
            const s = await checkSession(data.id).catch(() => null)
            if (s) return finish(s)
            timer = window.setTimeout(poll, 3000)
          }
          timer = window.setTimeout(poll, 3000)
          signal.addEventListener('abort', () => finish(null))
        }),
    }
  }
}

/** Verifies a Checkout Session (also used when Stripe redirects back with ?paid=cs_…). */
export async function checkSession(id: string): Promise<PaymentEvent | null> {
  const s = await (await fetch('./api/status?id=' + encodeURIComponent(id), { cache: 'no-store' })).json()
  if (!s.paid) return null
  const ev = payments.make(Number(s.amount), s.purpose === 'tienda' ? 'Compra' : 'Donación', s.purpose || 'donacion', s.payer || '', 'stripe')
  ev.id = 'stripe_' + id
  ev.at = s.at || Date.now()
  return ev
}

let detected: Promise<boolean> | null = null
export const backendInfo = () =>
  fetch('./api/health', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null) as Promise<{ stripe: boolean; storage: boolean } | null>
export function stripeReady(): Promise<boolean> {
  detected ??= backendInfo().then((j) => Boolean(j?.stripe))
  return detected
}

export async function getProvider(): Promise<PaymentProvider> {
  return (await stripeReady()) ? new StripeProvider() : new SimulatedProvider()
}
