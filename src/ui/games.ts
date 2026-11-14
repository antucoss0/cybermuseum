import { h } from '../core/util'

/** Full-screen 2D minigames reached through the portals in the videogame hall. */
export function playGame(ui: HTMLElement, kind: string, onExit: (score: number) => void) {
  const wrap = h('div', { class: 'iframe-wrap game-wrap' })
  const cv = h('canvas')
  const close = h('button', { class: 'icon-btn glass x' }, '✕')
  const bar = h('div', { class: 'gamebar glass' })
  wrap.append(cv, close, bar)
  ui.append(wrap)
  const g = cv.getContext('2d')!
  const dpr = Math.min(devicePixelRatio, 2)
  let W = 0
  let H = 0
  const resize = () => {
    W = cv.clientWidth
    H = cv.clientHeight
    cv.width = W * dpr
    cv.height = H * dpr
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  addEventListener('resize', resize)
  let raf = 0
  let score = 0
  const ptr = { x: W / 2, y: H / 2, down: false }
  const keys = new Set<string>()
  const kd = (e: KeyboardEvent) => {
    keys.add(e.code)
    if (e.code === 'Escape') end()
  }
  const ku = (e: KeyboardEvent) => keys.delete(e.code)
  addEventListener('keydown', kd)
  addEventListener('keyup', ku)
  cv.addEventListener('pointerdown', (e) => ((ptr.down = true), (ptr.x = e.offsetX), (ptr.y = e.offsetY)))
  cv.addEventListener('pointermove', (e) => ((ptr.x = e.offsetX), (ptr.y = e.offsetY)))
  addEventListener('pointerup', () => (ptr.down = false))
  let audio: AudioContext | null = null
  const tone = (f: number, d = 0.25, type: OscillatorType = 'sine', v = 0.08) => {
    try {
      audio ??= new AudioContext()
      const o = audio.createOscillator()
      const gn = audio.createGain()
      o.type = type
      o.frequency.value = f
      gn.gain.setValueAtTime(v, audio.currentTime)
      gn.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d)
      o.connect(gn).connect(audio.destination)
      o.start()
      o.stop(audio.currentTime + d)
    } catch {
      /* audio unavailable */
    }
  }
  const end = () => {
    cancelAnimationFrame(raf)
    removeEventListener('keydown', kd)
    removeEventListener('keyup', ku)
    removeEventListener('resize', resize)
    audio?.close()
    wrap.remove()
    onExit(score)
  }
  close.onclick = end
  const bg = () => {
    g.fillStyle = 'rgba(5,4,12,0.32)'
    g.fillRect(0, 0, W, H)
  }
  let last = performance.now()

  if (kind === 'stars') {
    const me = { x: W / 2, y: H / 2 }
    let stars: { x: number; y: number; life: number }[] = []
    let time = 45
    let spawned = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      bg()
      let vx = 0
      let vy = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) vy -= 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) vy += 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) vx -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) vx += 1
      if (vx || vy) {
        me.x += vx * 320 * dt
        me.y += vy * 320 * dt
      } else if (ptr.down) {
        me.x += (ptr.x - me.x) * Math.min(1, dt * 6)
        me.y += (ptr.y - me.y) * Math.min(1, dt * 6)
      }
      me.x = Math.max(10, Math.min(W - 10, me.x))
      me.y = Math.max(10, Math.min(H - 10, me.y))
      if (time > 0) time -= dt
      if (stars.length < 3 && spawned < 40 && time > 0) {
        stars.push({ x: 40 + Math.random() * (W - 80), y: 80 + Math.random() * (H - 140), life: 5 })
        spawned++
      }
      stars = stars.filter((s) => {
        s.life -= dt
        const d = Math.hypot(s.x - me.x, s.y - me.y)
        if (d < 28 && time > 0) {
          score++
          tone(440 * Math.pow(2, (score % 12) / 12), 0.4, 'triangle')
          return false
        }
        const a = Math.max(0, s.life / 5)
        g.fillStyle = `rgba(236,232,255,${a})`
        g.shadowColor = '#b89cff'
        g.shadowBlur = 20
        g.beginPath()
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? 5 : 16
          const an = (i / 8) * Math.PI * 2 + now / 900
          g.lineTo(s.x + Math.cos(an) * r, s.y + Math.sin(an) * r)
        }
        g.fill()
        return s.life > 0
      })
      g.shadowBlur = 28
      g.fillStyle = '#b89cff'
      g.beginPath()
      g.arc(me.x, me.y, 11, 0, Math.PI * 2)
      g.fill()
      g.shadowBlur = 0
      const done = score >= 12 || time <= 0
      bar.innerHTML = done
        ? `<b>${score >= 12 ? 'Cosecha completa ✦' : 'Se apagaron las estrellas'}</b><span>${score} / 12</span><button class="btn sm" data-r>Salir</button>`
        : `<span>Estrellas <b>${score}</b> / 12</span><span>Tiempo <b>${Math.ceil(time)}</b>s</span>`
      bar.querySelector('[data-r]')?.addEventListener('click', end)
      if (done && time > 0) time = 0
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
  } else {
    // Sinestesia: your gestures paint light and compose music
    const scale = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15]
    let lastNote = 0
    const trail: { x: number; y: number; hue: number; r: number; life: number }[] = []
    let prev = { x: ptr.x, y: ptr.y }
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      g.fillStyle = 'rgba(5,4,12,0.06)'
      g.fillRect(0, 0, W, H)
      const moved = Math.hypot(ptr.x - prev.x, ptr.y - prev.y)
      if (ptr.down || moved > 2) {
        const hue = 230 + (ptr.x / W) * 100
        trail.push({ x: ptr.x, y: ptr.y, hue, r: 4 + Math.min(30, moved), life: 1 })
        if (now - lastNote > 140 && (ptr.down || moved > 12)) {
          const n = scale[Math.floor((1 - ptr.y / H) * scale.length) % scale.length]
          tone(196 * Math.pow(2, n / 12), 0.9, ptr.down ? 'triangle' : 'sine', 0.05)
          lastNote = now
          score++
        }
      }
      prev = { x: ptr.x, y: ptr.y }
      g.globalCompositeOperation = 'lighter'
      for (let i = trail.length - 1; i >= 0; i--) {
        const t = trail[i]
        t.life -= dt * 0.4
        t.r += dt * 30
        if (t.life <= 0) {
          trail.splice(i, 1)
          continue
        }
        g.strokeStyle = `hsla(${t.hue},90%,70%,${t.life * 0.5})`
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(t.x, t.y, t.r, 0, Math.PI * 2)
        g.stroke()
      }
      g.globalCompositeOperation = 'source-over'
      bar.innerHTML = `<span>Mueve o arrastra para pintar con sonido</span><span>Notas <b>${score}</b></span>`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
  }
}
