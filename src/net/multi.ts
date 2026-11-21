import { joinRoom } from 'trystero'
import { Emitter } from '../core/util'
import type { PaymentEvent } from '../payments/bus'

export interface PeerPose {
  x: number
  y: number
  z: number
  yaw: number
  speed: number
  room: string
}
export interface PeerProfile {
  name: string
  kind: string
}

const APP_ID = 'ethercoded.cybermuseo.v1'

/** Serverless P2P presence over WebRTC (Nostr relays for signaling). */
export class Multi {
  connected = false
  peers = new Map<string, { pose?: PeerPose; profile?: PeerProfile }>()
  pose = new Emitter<{ id: string; pose: PeerPose }>()
  profile = new Emitter<{ id: string; profile: PeerProfile }>()
  left = new Emitter<string>()
  chat = new Emitter<{ id: string; name: string; text: string }>()
  payment = new Emitter<PaymentEvent>()
  count = new Emitter<number>()
  private sendPose: ((p: PeerPose) => void) | null = null
  private sendChat: ((t: string) => void) | null = null
  private sendPay: ((p: PaymentEvent) => void) | null = null
  private setProfile: ((p: PeerProfile) => void) | null = null

  private room: any = null
  private mic: MediaStream | null = null
  start(roomName: string, me: PeerProfile) {
    try {
      const room = joinRoom({ appId: APP_ID, identity: 'none' } as never, roomName)
      this.room = room
      ;(room as any).onPeerStream?.((stream: MediaStream) => {
        const a = new Audio()
        a.srcObject = stream
        a.autoplay = true
        a.play().catch(() => {})
      })
      const prof = room.makeUserState<PeerProfile>('profile', me)
      prof.set(me)
      prof.onChange((v, ctx) => {
        if (ctx.self) return
        const id = ctx.userId
        if (!v) return
        this.ensure(id).profile = v
        this.profile.emit({ id, profile: v })
      })
      this.setProfile = (p) => void prof.set(p)
      const pose = room.makeAction<PeerPose>('pose')
      pose.onMessage((p, ctx) => {
        this.ensure(ctx.userId).pose = p
        this.pose.emit({ id: ctx.userId, pose: p })
      })
      this.sendPose = (p) => void pose.send(p).catch(() => {})
      const chat = room.makeAction<string>('chat')
      chat.onMessage((t, ctx) => this.chat.emit({ id: ctx.userId, name: this.peers.get(ctx.userId)?.profile?.name ?? (document.documentElement.lang === 'en' ? 'Visitor' : 'Visitante'), text: String(t).slice(0, 140) }))
      this.sendChat = (t) => void chat.send(t).catch(() => {})
      const pay = room.makeAction<PaymentEvent>('payment')
      pay.onMessage((p) => this.payment.emit({ ...p, source: 'peer' }))
      this.sendPay = (p) => void pay.send(p).catch(() => {})
      room.onUserJoin((ctx) => {
        this.ensure(ctx.userId)
        this.count.emit(this.peers.size + 1)
      })
      room.onUserLeave((ctx) => {
        this.peers.delete(ctx.userId)
        this.left.emit(ctx.userId)
        this.count.emit(this.peers.size + 1)
      })
      this.connected = true
      this.count.emit(1)
      addEventListener('pagehide', () => void room.leave())
    } catch (e) {
      console.warn('multiplayer unavailable', e)
    }
  }

  private ensure(id: string) {
    let p = this.peers.get(id)
    if (!p) {
      p = {}
      this.peers.set(id, p)
    }
    return p
  }

  broadcastPose(p: PeerPose) {
    this.sendPose?.(p)
  }
  /** Toggles microphone sharing with everyone in the current room. Returns true when live. */
  async voice(): Promise<boolean> {
    if (!this.room) return false
    if (this.mic) {
      this.mic.getTracks().forEach((t) => (t.enabled = !t.enabled))
      return this.mic.getTracks()[0]?.enabled ?? false
    }
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    this.room.addStream?.(this.mic)
    this.room.onPeerJoin?.((id: string) => this.mic && this.room.addStream?.(this.mic, id))
    return true
  }
  say(text: string) {
    this.sendChat?.(text)
  }
  broadcastPayment(p: PaymentEvent) {
    if (p.source !== 'peer') this.sendPay?.(p)
  }
  updateProfile(p: PeerProfile) {
    this.setProfile?.(p)
  }
}
