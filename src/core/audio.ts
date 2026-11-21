import type { RoomId } from '../content/types'

/** Per-room generative soundscape: [root Hz, chord ratios, filter Hz, motif scale, motif rate, noise level, timbre]. */
type Profile = { root: number; chord: number[]; cutoff: number; scale: number[]; rate: number; noise: number; wave: OscillatorType; reverb: number }
const PROFILES: Record<RoomId | 'corridor', Profile> = {
  lobby: { root: 73.42, chord: [1, 1.5, 2, 2.4, 3], cutoff: 900, scale: [1, 1.2, 1.5, 1.8, 2, 2.4], rate: 0.35, noise: 0.015, wave: 'sawtooth', reverb: 0.75 },
  videosala: { root: 55, chord: [1, 1.19, 1.5, 2], cutoff: 520, scale: [2, 2.38, 3], rate: 0.12, noise: 0.03, wave: 'triangle', reverb: 0.4 },
  escultura: { root: 98, chord: [1, 1.5, 2.25], cutoff: 1400, scale: [4, 4.5, 5, 6, 6.75, 8], rate: 0.9, noise: 0.008, wave: 'sine', reverb: 0.8 },
  pintura: { root: 65.41, chord: [1, 1.25, 1.5, 1.875], cutoff: 760, scale: [2, 2.5, 3, 3.75], rate: 0.25, noise: 0.006, wave: 'triangle', reverb: 0.6 },
  tienda: { root: 87.31, chord: [1, 1.25, 1.5, 2], cutoff: 1800, scale: [2, 2.5, 3, 4, 5], rate: 1.6, noise: 0.004, wave: 'square', reverb: 0.35 },
  jardin: { root: 82.41, chord: [1, 1.5, 2, 2.67], cutoff: 1100, scale: [4, 5, 6, 8, 9], rate: 0.7, noise: 0.05, wave: 'sine', reverb: 0.55 },
  temporales: { root: 61.74, chord: [1, 1.2, 1.41, 1.8], cutoff: 650, scale: [2, 2.4, 2.83, 3.6], rate: 0.5, noise: 0.012, wave: 'sawtooth', reverb: 0.7 },
  videojuegos: { root: 49, chord: [1, 1.5, 2, 3, 4], cutoff: 2400, scale: [4, 4.5, 5.33, 6, 8, 9, 10.67], rate: 4, noise: 0.01, wave: 'sawtooth', reverb: 0.5 },
  futuro: { root: 41.2, chord: [1, 1.41, 2], cutoff: 400, scale: [3, 4.24], rate: 0.15, noise: 0.06, wave: 'sine', reverb: 0.9 },
  corridor: { root: 73.42, chord: [1, 1.5, 2], cutoff: 500, scale: [3, 4], rate: 0.1, noise: 0.02, wave: 'sine', reverb: 0.8 },
  salas: { root: 61.74, chord: [1, 1.26, 1.5, 1.89], cutoff: 760, scale: [1, 1.26, 1.5, 2, 2.52], rate: 0.25, noise: 0.012, wave: 'triangle', reverb: 0.8 },
  foro: { root: 49, chord: [1, 1.5, 2, 3], cutoff: 1400, scale: [1, 1.33, 1.5, 2, 2.67, 3], rate: 0.9, noise: 0.02, wave: 'sawtooth', reverb: 0.55 },
  juntas: { root: 82.41, chord: [1, 1.5, 2], cutoff: 400, scale: [1, 1.5, 2], rate: 0.08, noise: 0.006, wave: 'sine', reverb: 0.3 },
}

class Pad {
  out: GainNode
  private nodes: AudioScheduledSourceNode[] = []
  private motifT = 0
  constructor(private ctx: AudioContext, private p: Profile, dest: AudioNode, noise: AudioBuffer) {
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(dest)
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = p.cutoff
    filt.Q.value = 0.7
    filt.connect(this.out)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05 + Math.random() * 0.05
    const lfoG = ctx.createGain()
    lfoG.gain.value = p.cutoff * 0.45
    lfo.connect(lfoG).connect(filt.frequency)
    lfo.start()
    this.nodes.push(lfo)
    p.chord.forEach((r, i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = i === 0 ? 'sine' : p.wave
        o.frequency.value = p.root * r
        o.detune.value = det + Math.random() * 4
        const g = ctx.createGain()
        g.gain.value = (i === 0 ? 0.11 : 0.045 / (1 + i * 0.4)) * (p.wave === 'sine' ? 1.4 : 0.6)
        const trem = ctx.createOscillator()
        trem.frequency.value = 0.07 + Math.random() * 0.15
        const tg = ctx.createGain()
        tg.gain.value = g.gain.value * 0.5
        trem.connect(tg).connect(g.gain)
        o.connect(g).connect(filt)
        o.start()
        trem.start()
        this.nodes.push(o, trem)
      }
    })
    if (p.noise > 0) {
      const n = ctx.createBufferSource()
      n.buffer = noise
      n.loop = true
      const nf = ctx.createBiquadFilter()
      nf.type = 'bandpass'
      nf.frequency.value = 500
      nf.Q.value = 0.4
      const ng = ctx.createGain()
      ng.gain.value = p.noise
      n.connect(nf).connect(ng).connect(this.out)
      n.start()
      this.nodes.push(n)
    }
  }
  tick(dt: number, bell: (f: number, v: number) => void) {
    this.motifT -= dt
    if (this.motifT <= 0) {
      this.motifT = (1 / this.p.rate) * (0.5 + Math.random())
      const f = this.p.root * this.p.scale[Math.floor(Math.random() * this.p.scale.length)] * (Math.random() < 0.2 ? 2 : 1)
      bell(f, this.p.rate > 2 ? 0.05 : 0.09)
    }
  }
  fade(to: number, t: number) {
    const g = this.out.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(to, this.ctx.currentTime + t)
  }
  stop() {
    this.nodes.forEach((n) => n.stop())
    setTimeout(() => this.out.disconnect(), 100)
  }
}

export class AudioEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private wet!: GainNode
  private dry!: GainNode
  private noise!: AudioBuffer
  private pad: Pad | null = null
  private padRoom: string = ''
  private room: RoomId | 'corridor' = 'lobby'
  private stepAcc = 0
  private stepSide = 0
  muted = localStorage.getItem('cm.mute') === '1'
  volume = 0.8

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) return void this.ctx.resume()
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume
    this.master.connect(ctx.destination)
    const comp = ctx.createDynamicsCompressor()
    comp.connect(this.master)
    this.dry = ctx.createGain()
    this.dry.connect(comp)
    const conv = ctx.createConvolver()
    conv.buffer = this.impulse(4.2)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.6
    this.wet.connect(conv).connect(comp)
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    this.setRoom(this.room, true)
  }

  private impulse(sec: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * sec)
    const b = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    return b
  }

  private bus() {
    const g = this.ctx!.createGain()
    g.connect(this.dry)
    const s = this.ctx!.createGain()
    s.gain.value = PROFILES[this.room].reverb
    g.connect(s).connect(this.wet)
    return g
  }

  setRoom(room: RoomId | 'corridor', force = false) {
    this.room = room
    if (!this.ctx || (!force && room === this.padRoom)) return
    this.padRoom = room
    const old = this.pad
    old?.fade(0, 2.5)
    if (old) setTimeout(() => old.stop(), 2800)
    this.pad = new Pad(this.ctx, PROFILES[room], this.bus(), this.noise)
    this.pad.fade(1, 3)
  }

  setMuted(m: boolean) {
    this.muted = m
    localStorage.setItem('cm.mute', m ? '1' : '0')
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.2)
  }

  bell(f: number, v = 0.1, dur = 3) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const out = this.bus()
    for (const [m, a] of [[1, 1], [2.76, 0.3], [5.4, 0.12]]) {
      const o = ctx.createOscillator()
      o.frequency.value = f * m
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(v * a, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / m)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + dur)
    }
  }

  private step(surface: 'stone' | 'grass' | 'carpet') {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const f = ctx.createBiquadFilter()
    f.type = surface === 'grass' ? 'highpass' : 'lowpass'
    f.frequency.value = surface === 'stone' ? 1700 + Math.random() * 400 : surface === 'grass' ? 2500 : 500
    const g = ctx.createGain()
    const v = (surface === 'carpet' ? 0.12 : 0.22) * (this.stepSide ? 1 : 0.85)
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + (surface === 'grass' ? 0.16 : 0.09))
    const pan = ctx.createStereoPanner()
    pan.pan.value = this.stepSide ? 0.15 : -0.15
    src.connect(f).connect(g).connect(pan).connect(this.dry)
    if (surface === 'stone') {
      const s = ctx.createGain()
      s.gain.value = 0.35
      g.connect(s).connect(this.wet)
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(110, t)
      o.frequency.exponentialRampToValueAtTime(50, t + 0.06)
      const og = ctx.createGain()
      og.gain.setValueAtTime(0.18, t)
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
      o.connect(og).connect(this.dry)
      o.start(t)
      o.stop(t + 0.08)
    }
    src.start(t, Math.random() * 1.5, 0.2)
    this.stepSide ^= 1
  }

  /** Called every frame with player speed (m/s); emits footsteps at walking cadence. */
  tick(dt: number, speed: number, floating = false) {
    if (!this.ctx || this.muted) return
    this.pad?.tick(dt, (f, v) => this.bell(f, v))
    if (floating || speed < 0.4) return (this.stepAcc = 0.35)
    this.stepAcc += dt * (1.1 + speed * 0.32)
    if (this.stepAcc >= 1) {
      this.stepAcc = 0
      this.step(this.room === 'jardin' ? 'grass' : this.room === 'videosala' ? 'carpet' : 'stone')
    }
  }

  whoosh() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 3
    f.frequency.setValueAtTime(200, t)
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.9)
    f.frequency.exponentialRampToValueAtTime(300, t + 1.8)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.4, t + 0.6)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.9)
    src.connect(f).connect(g)
    g.connect(this.wet)
    g.connect(this.dry)
    src.start(t)
    src.stop(t + 2)
    this.bell(PROFILES[this.room].root * 4, 0.08, 4)
  }

  chime(amount: number) {
    const base = 523.25
    const n = Math.min(6, 2 + Math.floor(Math.log10(1 + amount) * 1.5))
    for (let i = 0; i < n; i++) setTimeout(() => this.bell(base * [1, 1.25, 1.5, 2, 2.5, 3][i], 0.12, 4), i * 110)
  }

  hover() {
    this.bell(880 + Math.random() * 220, 0.03, 0.8)
  }
}

export const audio = new AudioEngine()
