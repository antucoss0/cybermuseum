import { h, esc } from '../core/util'
import { content } from '../content/store'
import { AVATARS, type AvatarKind } from '../player/avatar'

const STAR = 'M60 4 L68 52 L116 60 L68 68 L60 116 L52 68 L4 60 L52 52 Z'

export function intro(ui: HTMLElement) {
  const el = h('div', { id: 'intro' })
  el.innerHTML = `<div class="mark"><svg viewBox="0 0 120 120"><path d="${STAR}"/></svg>
    <div class="word">CYBERMUSEO</div><div class="sub">ART · TECHNOLOGY · ETERNITY</div><div class="bar"><i></i></div></div>`
  ui.append(el)
  const bar = el.querySelector('.bar i') as HTMLElement
  return {
    progress: (p: number) => (bar.style.width = `${Math.round(p * 100)}%`),
    done: () =>
      new Promise<void>((res) => {
        bar.style.width = '100%'
        setTimeout(() => {
          el.classList.add('out')
          setTimeout(() => {
            el.remove()
            res()
          }, 1200)
        }, 2300)
      }),
  }
}

const rooms = () => {
  const c = content.data
  const list = ['videosala', 'escultura', 'pintura', 'tienda', 'jardin', 'temporales', 'videojuegos'] as const
  return list.map((id) => `<div class="glass"><b>${esc(c.rooms[id].name)}</b><span>${esc(c.rooms[id].subtitle)}</span></div>`).join('')
}

export function landing(ui: HTMLElement, onScroll: (p: number) => void, onEnter: () => void) {
  document.body.classList.add('landing-mode')
  const el = h('div', { id: 'landing' })
  el.innerHTML = `
  <div class="topbar">
    <a class="brand" href="#"><span class="glyph star">✦</span><span><b>CYBERMUSEO</b><small>ART · TECHNOLOGY · ETERNITY</small></span></a>
    <button class="btn primary sm" data-enter>Entrar al museo</button>
  </div>
  <section class="panel hero"><div class="card glass">
    <span class="kicker">Un museo infinito</span>
    <h1 class="serif">Arte, tecnología<br><em>y eternidad.</em></h1>
    <p>Cybermuseo es un edificio 3D persistente que puedes habitar desde cualquier navegador: una catedral neogótica futurista suspendida entre galaxias, donde el arte, la arquitectura y las personas que lo visitan comparten el mismo espacio.</p>
    <div class="row"><button class="btn primary" data-enter>Entrar ✦</button><button class="btn ghost" data-next>Descubrir</button></div>
  </div></section>
  <section class="panel right"><div class="card glass">
    <span class="kicker">01 · Concepto</span>
    <h2 class="serif">Una catedral para lo digital</h2>
    <p>Bóvedas de obsidiana, candelabros lavanda, tiras de neón y un piso de ajedrez infinito. Ventanales que dan al universo. Una estética <em>greco-futurista y oriental</em> donde ser pequeño y efímero frente al cosmos es también ser uno con él.</p>
    <div class="palette"><i style="background:#07060c"></i><i style="background:#1a1233"></i><i style="background:#8b5cf6"></i><i style="background:#b89cff"></i><i style="background:#ece8ff"></i></div>
  </div></section>
  <section class="panel"><div class="card glass">
    <span class="kicker">02 · Problema y solución</span>
    <h2 class="serif">Los museos digitales son páginas. Este es un lugar.</h2>
    <p>En vez de galerías sueltas, caminas en tercera persona por un solo edificio continuo: cruzas arcos, subes escaleras, descubres accesos físicos y entras a cada exposición sin cortes. Otros visitantes caminan contigo en tiempo real.</p>
    <ul><li>Avatar 3D en tercera persona · 3 personajes</li><li>Multijugador sin servidor (P2P)</li><li>Optimizado para móvil con joystick táctil</li></ul>
  </div></section>
  <section class="panel center"><div class="card glass wide">
    <span class="kicker">03 · El edificio</span>
    <h2 class="serif">Ocho alas alrededor de una cúpula</h2>
    <p>En el centro del lobby flota la <em>Nube Gaussiana</em>. Desde ahí, cada arco te lleva a una sala.</p>
    <div class="grid-rooms">${rooms()}</div>
  </div></section>
  <section class="panel right"><div class="card glass">
    <span class="kicker">04 · Arte vivo</span>
    <h2 class="serif">Cada pago enciende el museo</h2>
    <p>Una donación, una compra en la tienda o una flor para el jardín se convierten en luz: la nube entra en sobrecarga y fluye como líquido, la iluminación cambia de tono, el piso emite ondas y en el jardín exterior crece una planta nueva. Todos los visitantes lo ven al mismo tiempo.</p>
    <p class="muted">Pagos CoDi / SPEI vía pey (en integración) · modo demo activo</p>
  </div></section>
  <section class="panel"><div class="card glass">
    <span class="kicker">05 · Para artistas y curadores</span>
    <h2 class="serif">Salas permanentes, temporales y convocatorias</h2>
    <p>Un panel SuperAdmin permite subir imágenes, video y modelos 3D, curar exposiciones temporales, abrir convocatorias, publicar eventos y generar nuevos espacios de forma procedural a partir de una semilla.</p>
    <div class="tech"><span class="chip">Three.js</span><span class="chip">WebGL</span><span class="chip">WebRTC</span><span class="chip">Generativo</span><span class="chip">CoDi · pey</span><span class="chip">PWA-ready</span></div>
  </div></section>
  <section class="panel center"><div class="card glass">
    <span class="kicker">Entrada libre</span>
    <h1 class="serif">Cruza el umbral.</h1>
    <p>Elige un personaje y entra a la bóveda principal.</p>
    <button class="btn primary" data-enter>Entrar al museo ✦</button>
    <div class="foot"><span class="serif">Cybermuseo</span> · un proyecto de Ethercoded · 2026</div>
  </div></section>
  <div class="progress"><span data-pct>000</span><div class="track"><i></i></div><span>360°</span></div>
  <div class="dots"></div>
  <div class="scroll-hint">scroll ↓</div>`
  ui.append(el)
  const panels = [...el.querySelectorAll<HTMLElement>('.panel')]
  const dots = el.querySelector('.dots')!
  panels.forEach((p, i) => {
    const b = h('button', { 'aria-label': `Sección ${i + 1}` })
    b.onclick = () => p.scrollIntoView({ behavior: 'smooth' })
    dots.append(b)
  })
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.35 })
  panels.forEach((p) => io.observe(p))
  const track = el.querySelector('.track i') as HTMLElement
  const pct = el.querySelector('[data-pct]') as HTMLElement
  const hint = el.querySelector('.scroll-hint') as HTMLElement
  const scroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight
    const p = max > 0 ? scrollY / max : 0
    track.style.width = `${p * 100}%`
    pct.textContent = String(Math.round(p * 360)).padStart(3, '0')
    hint.style.opacity = p > 0.02 ? '0' : '1'
    const idx = Math.min(panels.length - 1, Math.round(p * (panels.length - 1)))
    dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === idx))
    onScroll(p)
  }
  addEventListener('scroll', scroll, { passive: true })
  scroll()
  el.querySelector('[data-next]')?.addEventListener('click', () => panels[1].scrollIntoView({ behavior: 'smooth' }))
  el.querySelectorAll('[data-enter]').forEach((b) => b.addEventListener('click', () => {
    removeEventListener('scroll', scroll)
    io.disconnect()
    el.remove()
    document.body.classList.remove('landing-mode')
    scrollTo(0, 0)
    onEnter()
  }))
}

export function selectCharacter(ui: HTMLElement): Promise<{ kind: AvatarKind; name: string }> {
  return new Promise((res) => {
    const saved = JSON.parse(localStorage.getItem('cm.profile') || '{}')
    let kind: AvatarKind = saved.kind ?? 'oraculo'
    const el = h('div', { id: 'select' })
    el.innerHTML = `<div class="head"><span class="kicker">Antes de entrar</span><h2 class="serif">Elige tu forma</h2></div>
      <div class="chars">${AVATARS.map((a) => `<button class="glass" data-k="${a.id}"><span class="star" style="color:${a.color}">✦</span><b class="serif">${a.name}</b><small>${a.role}</small><p>${a.desc}</p></button>`).join('')}</div>
      <div class="row"><input maxlength="16" placeholder="Tu nombre de visitante" value="${esc(saved.name ?? '')}"><button class="btn primary" data-go>Entrar ✦</button></div>`
    ui.append(el)
    const sync = () => el.querySelectorAll<HTMLButtonElement>('.chars button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind))
    el.querySelectorAll<HTMLButtonElement>('.chars button').forEach((b) => (b.onclick = () => ((kind = b.dataset.k as AvatarKind), sync())))
    sync()
    const input = el.querySelector('input') as HTMLInputElement
    const go = () => {
      const name = input.value.trim() || `Visitante ${Math.floor(Math.random() * 900 + 100)}`
      localStorage.setItem('cm.profile', JSON.stringify({ kind, name }))
      el.remove()
      res({ kind, name })
    }
    el.querySelector('[data-go]')!.addEventListener('click', go)
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go())
  })
}
