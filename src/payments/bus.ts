import { Emitter, hashString, uid } from '../core/util'

export type PaymentSource = 'sim' | 'pey' | 'peer'
export type PaymentPurpose = 'donacion' | 'tienda' | 'jardin' | 'entrada'

export interface PaymentEvent {
  id: string
  amount: number
  concept: string
  purpose: PaymentPurpose
  payer: string
  at: number
  source: PaymentSource
  seed: number
}

const KEY = 'cm.payments.v1'
const MAX = 400

function load(): PaymentEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

class PaymentBus {
  list: PaymentEvent[] = load()
  private ids = new Set(this.list.map((p) => p.id))
  /** Fired for every new payment (local, peer or pey webhook relay). */
  received = new Emitter<PaymentEvent>()

  ingest(p: PaymentEvent): boolean {
    if (this.ids.has(p.id)) return false
    this.ids.add(p.id)
    this.list.push(p)
    this.list.sort((a, b) => a.at - b.at)
    if (this.list.length > MAX) this.list.splice(0, this.list.length - MAX)
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list))
    } catch {}
    this.received.emit(p)
    return true
  }

  make(amount: number, concept: string, purpose: PaymentPurpose, payer: string, source: PaymentSource): PaymentEvent {
    const id = uid('pay_')
    return { id, amount, concept, purpose, payer, at: Date.now(), source, seed: hashString(id) }
  }

  total() {
    return this.list.reduce((s, p) => s + p.amount, 0)
  }

  clear() {
    this.list = []
    this.ids.clear()
    localStorage.removeItem(KEY)
  }
}

export const payments = new PaymentBus()
