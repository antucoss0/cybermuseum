import { mulberry32, type Rng } from './util'

// Procedural "paintings" used for artworks, product thumbnails and posters.
type Gen = (g: CanvasRenderingContext2D, s: number, r: Rng) => void

const PAL = ['#b89cff', '#8b5cf6', '#d8ccff', '#5b6cff', '#ffffff', '#3b1d7a', '#7fb2ff']
const pick = (r: Rng) => PAL[Math.floor(r() * PAL.length)]

function bg(g: CanvasRenderingContext2D, s: number, r: Rng, a = '#0a0814', b = '#1a1033') {
  const gr = g.createRadialGradient(s * (0.3 + r() * 0.4), s * (0.3 + r() * 0.4), 0, s / 2, s / 2, s * 0.8)
  gr.addColorStop(0, b)
  gr.addColorStop(1, a)
  g.fillStyle = gr
  g.fillRect(0, 0, s, s)
}

function stars(g: CanvasRenderingContext2D, s: number, r: Rng, n = 300) {
  for (let i = 0; i < n; i++) {
    const x = r() * s
    const y = r() * s
    const rad = r() < 0.97 ? r() * 1.1 + 0.2 : r() * 2.4 + 1
    g.fillStyle = `rgba(${220 + r() * 35},${210 + r() * 45},255,${0.3 + r() * 0.7})`
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
  }
}

function glowDot(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad)
  gr.addColorStop(0, color)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.globalAlpha = a
  g.fillStyle = gr
  g.beginPath()
  g.arc(x, y, rad, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
}

function sparkle(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  g.save()
  g.translate(x, y)
  g.fillStyle = '#f3eeff'
  g.shadowColor = '#b89cff'
  g.shadowBlur = size * 2
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const rr = i % 2 === 0 ? size : size * 0.18
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
  g.restore()
}

const gens: Record<string, Gen> = {
  nebula(g, s, r) {
    bg(g, s, r, '#05040b', '#120a26')
    g.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2
      const d = Math.pow(r(), 0.7) * s * 0.42
      glowDot(g, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d * 0.6, s * (0.05 + r() * 0.18), pick(r), 0.18)
    }
    // spiral arms
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 500; i++) {
        const t = i / 500
        const a = t * Math.PI * 3.2 + arm * Math.PI + (r() - 0.5) * 0.5
        const d = t * s * 0.42
        g.fillStyle = `rgba(216,204,255,${0.5 * (1 - t)})`
        g.fillRect(s / 2 + Math.cos(a) * d + (r() - 0.5) * 10, s / 2 + Math.sin(a) * d * 0.55 + (r() - 0.5) * 10, 1.6, 1.6)
      }
    }
    glowDot(g, s / 2, s / 2, s * 0.12, '#ffffff', 0.8)
    g.globalCompositeOperation = 'source-over'
    stars(g, s, r, 260)
  },
  rose(g, s, r) {
    bg(g, s, r, '#06050d', '#160d2c')
    g.translate(s / 2, s / 2)
    const petals = 8 + Math.floor(r() * 6) * 2
    g.lineWidth = s / 260
    for (let ring = 0; ring < 6; ring++) {
      const rad = s * (0.08 + ring * 0.065)
      g.strokeStyle = ring % 2 ? '#b89cff' : '#d8ccff'
      g.shadowColor = '#8b5cf6'
      g.shadowBlur = 12
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + ring * 0.2
        g.beginPath()
        g.ellipse(Math.cos(a) * rad, Math.sin(a) * rad, rad * 0.45, rad * 0.16, a, 0, Math.PI * 2)
        g.stroke()
      }
      g.beginPath()
      g.arc(0, 0, rad * 1.35, 0, Math.PI * 2)
      g.stroke()
    }
    g.setTransform(1, 0, 0, 1, 0, 0)
    glowDot(g, s / 2, s / 2, s * 0.1, '#ffffff', 0.9)
    sparkle(g, s / 2, s / 2, s * 0.05)
  },
  flower(g, s, r) {
    bg(g, s, r, '#04030a', '#1b1238')
    stars(g, s, r, 160)
    g.translate(s / 2, s * 0.58)
    // stem
    g.strokeStyle = 'rgba(184,156,255,.6)'
    g.lineWidth = s / 140
    g.beginPath()
    g.moveTo(0, 0)
    g.bezierCurveTo(s * 0.05, s * 0.15, -s * 0.06, s * 0.28, 0, s * 0.45)
    g.stroke()
    const layers = 4
    for (let l = layers; l > 0; l--) {
      const n = 6 + l * 2
      const len = s * (0.1 + l * 0.065)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + l * 0.3
        g.save()
        g.rotate(a)
        const gr = g.createLinearGradient(0, 0, 0, -len)
        gr.addColorStop(0, 'rgba(255,255,255,.9)')
        gr.addColorStop(0.5, `rgba(184,156,255,${0.35 + l * 0.1})`)
        gr.addColorStop(1, 'rgba(91,108,255,.1)')
        g.fillStyle = gr
        g.strokeStyle = 'rgba(216,204,255,.7)'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(0, 0)
        g.bezierCurveTo(len * 0.35, -len * 0.35, len * 0.2, -len * 0.9, 0, -len)
        g.bezierCurveTo(-len * 0.2, -len * 0.9, -len * 0.35, -len * 0.35, 0, 0)
        g.fill()
        g.stroke()
        g.restore()
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0)
    glowDot(g, s / 2, s * 0.58, s * 0.08, '#fff', 0.9)
  },
  portal(g, s, r) {
    bg(g, s, r, '#050409', '#0f0a1f')
    // pointed arches receding
    for (let i = 0; i < 9; i++) {
      const k = 1 - i / 10
      const w = s * 0.7 * k
      const hgt = s * 0.85 * k
      const x = s / 2
      const y = s * 0.95 - (1 - k) * s * 0.25
      g.strokeStyle = `rgba(${184 + i * 6},${156 + i * 8},255,${0.25 + k * 0.6})`
      g.lineWidth = 2 + k * 3
      g.shadowColor = '#8b5cf6'
      g.shadowBlur = 18
      g.beginPath()
      g.moveTo(x - w / 2, y)
      g.lineTo(x - w / 2, y - hgt * 0.55)
      g.quadraticCurveTo(x - w / 2, y - hgt * 0.92, x, y - hgt)
      g.quadraticCurveTo(x + w / 2, y - hgt * 0.92, x + w / 2, y - hgt * 0.55)
      g.lineTo(x + w / 2, y)
      g.stroke()
    }
    g.shadowBlur = 0
    glowDot(g, s / 2, s * 0.55, s * 0.25, '#8b5cf6', 0.6)
    stars(g, s, r, 120)
    sparkle(g, s / 2, s * 0.5, s * 0.06)
    // checker floor
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2) continue
        g.fillStyle = `rgba(230,225,255,${0.05 + j * 0.03})`
        g.fillRect((i / 14) * s, s * 0.88 + j * s * 0.03, s / 14, s * 0.03)
      }
  },
  tide(g, s, r) {
    bg(g, s, r, '#03040c', '#0d1030')
    stars(g, s, r, 200)
    g.globalCompositeOperation = 'lighter'
    const lines = 70
    for (let i = 0; i < lines; i++) {
      const y0 = s * 0.35 + (i / lines) * s * 0.6
      g.strokeStyle = `rgba(${130 + i},${120 + i},255,${0.12 + (i / lines) * 0.4})`
      g.lineWidth = 1.2
      g.beginPath()
      const f = 2 + r() * 2
      const ph = r() * 6
      for (let x = 0; x <= s; x += 4) {
        const y = y0 + Math.sin((x / s) * f * Math.PI + ph + i * 0.15) * s * 0.03 * (1 + i / lines)
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
    glowDot(g, s * 0.7, s * 0.22, s * 0.12, '#d8ccff', 0.9)
    g.globalCompositeOperation = 'source-over'
  },
  eclipse(g, s, r) {
    bg(g, s, r, '#020205', '#0c0a1a')
    stars(g, s, r, 300)
    const cx = s / 2
    const cy = s * 0.46
    glowDot(g, cx, cy, s * 0.42, '#8b5cf6', 0.55)
    glowDot(g, cx, cy, s * 0.26, '#ffffff', 0.85)
    g.fillStyle = '#030208'
    g.beginPath()
    g.arc(cx + s * 0.02, cy, s * 0.17, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(216,204,255,.8)'
    g.lineWidth = 1.5
    g.beginPath()
    g.ellipse(cx, cy, s * 0.34, s * 0.06, -0.3, 0, Math.PI * 2)
    g.stroke()
    // small figure
    g.fillStyle = '#000'
    g.fillRect(cx - 3, s * 0.86, 6, -s * 0.06)
    g.beginPath()
    g.arc(cx, s * 0.795, 4, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(184,156,255,.08)'
    g.fillRect(0, s * 0.86, s, s * 0.14)
  },
  glyph(g, s, r) {
    bg(g, s, r, '#07050e', '#150e29')
    const n = 6
    const cell = s / n
    g.lineCap = 'round'
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = i * cell + cell / 2
        const y = j * cell + cell / 2
        g.strokeStyle = r() < 0.2 ? '#ffffff' : '#b89cff'
        g.shadowColor = '#8b5cf6'
        g.shadowBlur = 10
        g.lineWidth = 2
        g.beginPath()
        const k = Math.floor(r() * 4)
        if (k === 0) g.arc(x, y, cell * 0.28, r() * 6, r() * 6 + 3.5)
        if (k === 1) {
          g.moveTo(x - cell * 0.3, y)
          g.lineTo(x + cell * 0.3, y)
          g.moveTo(x, y - cell * 0.3)
          g.lineTo(x, y + cell * 0.3)
        }
        if (k === 2) {
          g.moveTo(x - cell * 0.25, y + cell * 0.25)
          g.lineTo(x, y - cell * 0.3)
          g.lineTo(x + cell * 0.25, y + cell * 0.25)
        }
        if (k === 3) {
          g.arc(x, y, cell * 0.12, 0, Math.PI * 2)
          g.moveTo(x + cell * 0.3, y)
          g.arc(x, y, cell * 0.3, 0, Math.PI * 2)
        }
        g.stroke()
      }
    g.shadowBlur = 0
  },
  choir(g, s, r) {
    bg(g, s, r, '#040309', '#120b24')
    // nave perspective
    const vx = s / 2
    const vy = s * 0.45
    g.strokeStyle = 'rgba(184,156,255,.45)'
    g.lineWidth = 1.2
    for (let i = 0; i < 12; i++) {
      const x = (i / 11) * s
      g.beginPath()
      g.moveTo(x, s)
      g.lineTo(vx + (x - vx) * 0.12, vy)
      g.stroke()
    }
    for (let k = 0; k < 7; k++) {
      const t = Math.pow(k / 7, 1.6)
      const w = s * (1 - t * 0.85)
      const top = vy - (s * 0.5) * (1 - t * 0.85)
      g.strokeStyle = `rgba(216,204,255,${0.2 + (1 - t) * 0.6})`
      g.lineWidth = 1 + (1 - t) * 3
      g.shadowColor = '#8b5cf6'
      g.shadowBlur = 14
      g.beginPath()
      g.moveTo(vx - w / 2, s)
      g.lineTo(vx - w / 2, vy + (s - vy) * 0.1)
      g.quadraticCurveTo(vx - w / 2, top, vx, top - w * 0.15)
      g.quadraticCurveTo(vx + w / 2, top, vx + w / 2, vy + (s - vy) * 0.1)
      g.lineTo(vx + w / 2, s)
      g.stroke()
    }
    g.shadowBlur = 0
    glowDot(g, vx, vy, s * 0.16, '#fff', 0.9)
    stars(g, s, r, 80)
  },
}

export const GEN_2D = Object.keys(gens)

const cache = new Map<string, HTMLCanvasElement>()

export function paint(gen: string | undefined, seed = 1, size = 512): HTMLCanvasElement {
  const key = `${gen}:${seed}:${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  ;(gens[gen ?? ''] ?? gens.nebula)(g, size, mulberry32(seed * 9973 + 17))
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
  g.shadowBlur = 0
  cache.set(key, c)
  return c
}

export function paintClone(gen: string | undefined, seed = 1, size = 512): HTMLCanvasElement {
  const src = paint(gen, seed, size)
  const c = document.createElement('canvas')
  c.width = c.height = size
  c.getContext('2d')!.drawImage(src, 0, 0)
  return c
}
