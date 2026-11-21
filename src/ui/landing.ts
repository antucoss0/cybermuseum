import { L, tx, langButton, bindLang } from '../core/i18n'
import { h, esc } from '../core/util'
import { content } from '../content/store'
import { AVATARS, type AvatarKind } from '../player/avatar'
import * as THREE from 'three'
import { loadRig, type Rig } from '../player/rigged'

const STAR = 'M60 4 L68 52 L116 60 L68 68 L60 116 L52 68 L4 60 L52 52 Z'

export function intro(ui: HTMLElement) {
  const el = h('div', { id: 'intro' })
  el.innerHTML = `<div class="mark"><svg viewBox="0 0 120 120"><path d="${STAR}"/></svg>
    <div class="word">CYBER MUSEUM</div><div class="sub">ART · TECHNOLOGY · ETERNITY</div><div class="bar"><i></i></div></div>`
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
  return list.map((id) => `<div class="glass"><b>${esc(tx(c.rooms[id], 'name'))}</b><span>${esc(tx(c.rooms[id], 'subtitle'))}</span></div>`).join('')
}

export function landing(ui: HTMLElement, onScroll: (p: number) => void, onEnter: () => void) {
  document.body.classList.add('landing-mode')
  const el = h('div', { id: 'landing' })
  el.innerHTML = `
  <div class="topbar">
    <a class="brand" href="#"><span class="glyph star">✦</span><span><b>CYBER MUSEUM</b><small>ART · TECHNOLOGY · ETERNITY</small></span></a>
    <div class="row" style="margin:0">${langButton()}<button class="btn primary sm" data-enter>${L('Entrar al museo', 'Enter the museum')}</button></div>
  </div>
  <section class="panel hero"><div class="card glass">
    <span class="kicker">${L('Un museo infinito', 'An infinite museum')}</span>
    <h1 class="serif">${L('Arte, tecnología<br><em>y eternidad.</em>', 'Art, technology<br><em>and eternity.</em>')}</h1>
    <p>${L('Cyber Museum es un edificio 3D persistente que puedes habitar desde cualquier navegador: una catedral neogótica futurista suspendida entre galaxias, donde el arte, la arquitectura y las personas que lo visitan comparten el mismo espacio.', 'Cyber Museum is a persistent 3D building you can inhabit from any browser: a futurist neo-gothic cathedral suspended among galaxies, where art, architecture and the people who visit share the same space.')}</p>
    <div class="row"><button class="btn primary" data-enter>${L('Entrar', 'Enter')} ✦</button><button class="btn ghost" data-next>${L('Descubrir', 'Discover')}</button></div>
  </div></section>
  <section class="panel right"><div class="card glass">
    <span class="kicker">01 · ${L('Concepto', 'Concept')}</span>
    <h2 class="serif">${L('Una catedral para lo digital', 'A cathedral for the digital')}</h2>
    <p>${L('Bóvedas de obsidiana, candelabros lavanda, tiras de neón y un piso de ajedrez infinito. Ventanales que dan al universo. Una estética <em>greco-futurista y oriental</em> donde ser pequeño y efímero frente al cosmos es también ser uno con él.', 'Obsidian vaults, lavender chandeliers, neon strips and an endless chessboard floor. Windows that open onto the universe. A <em>Greco-futurist and oriental</em> aesthetic where being small and ephemeral before the cosmos is also being one with it.')}</p>
    <div class="palette"><i style="background:#07060c"></i><i style="background:#1a1233"></i><i style="background:#8b5cf6"></i><i style="background:#b89cff"></i><i style="background:#ece8ff"></i></div>
  </div></section>
  <section class="panel"><div class="card glass">
    <span class="kicker">02 · ${L('Problema y solución', 'Problem & solution')}</span>
    <h2 class="serif">${L('Los museos digitales son páginas. Este es un lugar.', 'Digital museums are pages. This is a place.')}</h2>
    <p>${L('En vez de galerías sueltas, caminas en tercera persona por un solo edificio continuo: cruzas arcos, subes escaleras, descubres accesos físicos y entras a cada exposición sin cortes. Otros visitantes caminan contigo en tiempo real.', 'Instead of loose galleries, you walk in third person through a single continuous building: you pass through arches, climb stairs, find physical entrances and step into every exhibition without cuts. Other visitors walk with you in real time.')}</p>
    <ul>${L('<li>Avatar 3D en tercera persona · 3 personajes</li><li>Multijugador sin servidor (P2P)</li><li>Optimizado para móvil con joystick táctil</li>', '<li>Third-person 3D avatar · 3 characters</li><li>Serverless multiplayer (P2P)</li><li>Mobile-ready with a touch joystick</li>')}</ul>
  </div></section>
  <section class="panel center"><div class="card glass wide">
    <span class="kicker">03 · ${L('El edificio', 'The building')}</span>
    <h2 class="serif">${L('Ocho alas alrededor de una cúpula', 'Eight wings around a dome')}</h2>
    <p>${L('En el centro del lobby flota la <em>Nube Gaussiana</em>. Desde ahí, cada arco te lleva a una sala.', 'The <em>Gaussian Cloud</em> floats at the center of the lobby. From there, every arch leads to a hall.')}</p>
    <div class="grid-rooms">${rooms()}</div>
  </div></section>
  <section class="panel right"><div class="card glass">
    <span class="kicker">04 · ${L('Arte vivo', 'Living art')}</span>
    <h2 class="serif">${L('Cada pago enciende el museo', 'Every payment lights up the museum')}</h2>
    <p>${L('Una donación, una compra en la tienda o una flor para el jardín se convierten en luz: la nube entra en sobrecarga y fluye como líquido, la iluminación cambia de tono, el piso emite ondas y en el jardín exterior crece una planta nueva. Todos los visitantes lo ven al mismo tiempo.', 'A donation, a shop purchase or a flower for the garden turns into light: the cloud overloads and flows like liquid, the lighting changes hue, the floor sends out waves and a new plant grows in the outdoor garden. Every visitor sees it at the same time.')}</p>
    <p class="muted">${L('Pagos con Stripe · modo demo sin credenciales', 'Stripe payments · demo mode without credentials')}</p>
  </div></section>
  <section class="panel"><div class="card glass">
    <span class="kicker">05 · ${L('Para artistas y curadores', 'For artists and curators')}</span>
    <h2 class="serif">${L('Salas permanentes, temporales y convocatorias', 'Permanent halls, temporary shows and open calls')}</h2>
    <p>${L('Un panel SuperAdmin permite subir imágenes, video y modelos 3D, curar exposiciones temporales, abrir convocatorias, publicar eventos y generar nuevos espacios de forma procedural a partir de una semilla.', 'A SuperAdmin panel lets you upload images, video and 3D models, curate temporary exhibitions, open calls, publish events and procedurally generate new spaces from a seed.')}</p>
    <div class="tech"><span class="chip">Three.js</span><span class="chip">WebGL</span><span class="chip">WebRTC</span><span class="chip">${L('Generativo', 'Generative')}</span><span class="chip">Stripe</span><span class="chip">PWA-ready</span></div>
  </div></section>
  <section class="panel right"><div class="card glass">
    <span class="kicker">06 · ${L('Experiencia', 'Experience')}</span>
    <h2 class="serif">${L('Se escucha, se recorre, se habita', 'You hear it, walk it, inhabit it')}</h2>
    <p>${L('Cada sala tiene su propia música generativa y su acústica; tus pasos suenan distinto en piedra, alfombra o pasto. Cruzar un arco se siente como atravesar un portal.', 'Every hall has its own generative score and acoustics; your footsteps sound different on stone, carpet or grass. Crossing an arch feels like stepping through a portal.')}</p>
    <div class="stats">
      <div><b data-count="8">0</b><span>${L('salas', 'halls')}</span></div>
      <div><b data-count="56000">0</b><span>${L('partículas vivas', 'living particles')}</span></div>
      <div><b data-count="3">0</b><span>${L('personajes', 'characters')}</span></div>
      <div><b data-count="2">0</b><span>${L('idiomas', 'languages')}</span></div>
    </div>
    <div class="tech"><span class="chip">WebXR · VR</span><span class="chip">WebXR · AR</span><span class="chip">${L('Móvil y tablet', 'Mobile & tablet')}</span><span class="chip">${L('Audio espacial', 'Spatial audio')}</span><span class="chip">${L('Calidad adaptativa', 'Adaptive quality')}</span></div>
  </div></section>
  <section class="panel"><div class="card glass wide faq">
    <span class="kicker">07 · ${L('Preguntas', 'Questions')}</span>
    <h2 class="serif">${L('Antes de cruzar', 'Before you cross')}</h2>
    <details><summary>${L('¿Necesito instalar algo?', 'Do I need to install anything?')}</summary><p>${L('No. Funciona en cualquier navegador moderno, en computadora, tablet o celular. Si tu visor soporta WebXR, aparecen los botones VR y AR.', 'No. It runs in any modern browser on desktop, tablet or phone. If your headset supports WebXR, VR and AR buttons appear.')}</p></details>
    <details><summary>${L('¿Cómo me muevo?', 'How do I move?')}</summary><p>${L('WASD o flechas y el mouse en computadora; joystick y arrastre en pantallas táctiles; controles del visor en VR. El menú te teletransporta a cualquier sala.', 'WASD or arrows plus the mouse on desktop; joystick and drag on touch screens; controller sticks in VR. The menu teleports you to any hall.')}</p></details>
    <details><summary>${L('¿Hay otras personas dentro?', 'Are other people inside?')}</summary><p>${L('Sí. Los visitantes se conectan entre sí en tiempo real, sin servidor central: se ven caminar y pueden chatear.', 'Yes. Visitors connect to each other in real time without a central server: you see them walk and can chat.')}</p></details>
    <details><summary>${L('¿Cómo apoyo al museo?', 'How do I support the museum?')}</summary><p>${L('Con una donación o una compra en la tienda. Cada pago enciende la nube y hace florecer una planta en el jardín.', 'With a donation or a shop purchase. Every payment ignites the cloud and makes a plant bloom in the garden.')}</p></details>
    <details><summary>${L('Soy artista, ¿cómo expongo?', 'I am an artist, how do I exhibit?')}</summary><p>${L('Las convocatorias abiertas viven en la sala de Exposiciones Temporales: envías tu propuesta desde ahí y el equipo curatorial la revisa.', 'Open calls live in the Temporary Exhibitions hall: submit your proposal there and the curatorial team reviews it.')}</p></details>
  </div></section>
  <section class="panel center"><div class="card glass">
    <span class="kicker">${L('Entrada libre', 'Free entry')}</span>
    <h1 class="serif">${L('Cruza el umbral.', 'Cross the threshold.')}</h1>
    <p>${L('Elige un personaje y entra a la bóveda principal.', 'Choose a character and step into the main vault.')}</p>
    <button class="btn primary" data-enter>${L('Entrar al museo', 'Enter the museum')} ✦</button>
    <div class="foot"><span class="serif">Cyber Museum</span> · ${L('un proyecto de Ethercoded', 'an Ethercoded project')} · 2026</div>
  </div></section>
  <div class="progress"><span data-pct>000</span><div class="track"><i></i></div><span>360°</span></div>
  <div class="dots"></div>
  <div class="scroll-hint">scroll ↓</div>`
  ui.append(el)
  bindLang(el)
  const panels = [...el.querySelectorAll<HTMLElement>('.panel')]
  const dots = el.querySelector('.dots')!
  panels.forEach((p, i) => {
    const b = h('button', { 'aria-label': `${L('Sección', 'Section')} ${i + 1}` })
    b.onclick = () => p.scrollIntoView({ behavior: 'smooth' })
    dots.append(b)
  })
  splitWords(el)
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        e.target.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp)
      }),
    { threshold: 0.35 },
  )
  const pointer = (e: PointerEvent) => {
    el.style.setProperty('--mx', `${e.clientX}px`)
    el.style.setProperty('--my', `${e.clientY}px`)
    for (const card of el.querySelectorAll<HTMLElement>('.panel.in .card')) {
      const r = card.getBoundingClientRect()
      const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom
      const dx = inside ? (e.clientX - r.left) / r.width - 0.5 : 0
      const dy = inside ? (e.clientY - r.top) / r.height - 0.5 : 0
      card.style.setProperty('--tilt', `${(-dy).toFixed(3)} ${dx.toFixed(3)} 0 ${(Math.hypot(dx, dy) * 7).toFixed(2)}deg`)
      card.style.setProperty('--gx', `${(dx + 0.5) * 100}%`)
      card.style.setProperty('--gy', `${(dy + 0.5) * 100}%`)
    }
    for (const b of el.querySelectorAll<HTMLElement>('.btn')) {
      const r = b.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const d = Math.hypot(e.clientX - cx, e.clientY - cy)
      const k = d < 110 ? (1 - d / 110) * 0.3 : 0
      b.style.translate = `${((e.clientX - cx) * k).toFixed(1)}px ${((e.clientY - cy) * k).toFixed(1)}px`
    }
  }
  if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', pointer, { passive: true })
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
    removeEventListener('pointermove', pointer)
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
    el.innerHTML = `<div class="head"><span class="kicker">${L('Antes de entrar', 'Before entering')}</span><h2 class="serif">${L('Elige tu forma', 'Choose your form')}</h2></div>
      <div class="chars">${AVATARS.map((a) => `<button class="glass" data-k="${a.id}"><span class="star" style="color:${a.color}">✦</span><b class="serif">${a.name}</b><small>${a.role}</small><p>${a.desc}</p></button>`).join('')}</div>
      <div class="row"><input maxlength="16" placeholder="${L('Tu nombre de visitante', 'Your visitor name')}" value="${esc(saved.name ?? '')}"><button class="btn primary" data-go>${L('Entrar', 'Enter')} ✦</button></div>`
    ui.append(el)
    history.replaceState(null, '', location.pathname + location.search + '#/personajes')
    const stage = characterStage(el)
    const sync = () => {
      el.querySelectorAll<HTMLButtonElement>('.chars button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind))
      stage.select(kind)
    }
    el.querySelectorAll<HTMLButtonElement>('.chars button').forEach((b) => {
      b.onclick = () => ((kind = b.dataset.k as AvatarKind), sync())
      b.onpointerenter = () => stage.hover(b.dataset.k as AvatarKind)
      b.onpointerleave = () => stage.hover(null)
    })
    stage.pick = (k) => ((kind = k), sync())
    sync()
    const input = el.querySelector('input') as HTMLInputElement
    const go = () => {
      const name = input.value.trim() || `${L('Visitante', 'Visitor')} ${Math.floor(Math.random() * 900 + 100)}`
      localStorage.setItem('cm.profile', JSON.stringify({ kind, name }))
      stage.dispose()
      el.remove()
      res({ kind, name })
    }
    el.querySelector('[data-go]')!.addEventListener('click', go)
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go())
  })
}

/** Live 3D line-up of the three rigged characters; hovering plays each one's presentation. */
function characterStage(host: HTMLElement) {
  const canvas = h('canvas', { class: 'stage' }) as HTMLCanvasElement
  host.prepend(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  scene.add(new THREE.HemisphereLight('#c9b3ff', '#120c26', 1.4))
  const key = new THREE.DirectionalLight('#ffffff', 2.2)
  key.position.set(2, 4, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#8b5cf6', 3)
  rim.position.set(-3, 3, -4)
  scene.add(rim)
  const slots = AVATARS.map((a, i) => {
    const g = new THREE.Group()
    g.position.x = (i - 1) * 1.55
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 48), new THREE.MeshStandardMaterial({ color: '#15121f', metalness: 0.8, roughness: 0.3 }))
    disc.position.y = -0.04
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(a.color).multiplyScalar(2), toneMapped: false }))
    ring.rotation.x = Math.PI / 2
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3.2, 32, 1, true), new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
    beam.position.y = 1.6
    g.add(disc, ring, beam)
    scene.add(g)
    const slot = { kind: a.id, g, ring, beam, rig: null as Rig | null, lift: 0 }
    loadRig(a.id, a.color).then((r) => (slot.rig = r) && g.add(r.root)).catch(() => {})
    return slot
  })
  let hovered: AvatarKind | null = null
  let selected: AvatarKind = 'oraculo'
  let raf = 0
  let last = performance.now()
  const resize = () => {
    const w = innerWidth
    const hh = innerHeight
    renderer.setSize(w, hh, false)
    cam.aspect = w / hh
    const fit = cam.aspect < 1 ? 9.5 / cam.aspect ** 0.55 : 7.2
    cam.position.set(0, 1.5, fit)
    cam.lookAt(0, 0.95, 0)
    cam.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)
  const ray = new THREE.Raycaster()
  const pickAt = (e: PointerEvent) => {
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), cam)
    let best: AvatarKind | null = null
    let bd = 0.75
    for (const s of slots) {
      const d = ray.ray.distanceToPoint(s.g.position.clone().setY(0.9))
      if (d < bd) ((bd = d), (best = s.kind))
    }
    return best
  }
  const move = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,input')) return
    api.hover(pickAt(e))
  }
  const click = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,input')) return
    const k = pickAt(e)
    if (k) api.pick(k)
  }
  addEventListener('pointermove', move)
  addEventListener('pointerdown', click)
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const t = now / 1000
    for (const s of slots) {
      const on = s.kind === hovered || (!hovered && s.kind === selected)
      s.lift += ((on ? 1 : 0) - s.lift) * Math.min(1, dt * 6)
      s.g.scale.setScalar(1 + s.lift * 0.12)
      s.g.rotation.y = Math.PI + Math.sin(t * 0.4 + s.g.position.x) * 0.25 + (s.kind === hovered ? Math.sin(t * 0.8) * 0.35 : 0)
      ;(s.beam.material as THREE.MeshBasicMaterial).opacity = 0.04 + s.lift * 0.14
      s.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.03 * (1 + s.lift))
      s.rig?.update(dt, 0, t)
    }
    renderer.render(scene, cam)
  }
  raf = requestAnimationFrame(loop)
  const api = {
    pick: (_k: AvatarKind) => {},
    select(k: AvatarKind) {
      selected = k
    },
    hover(k: AvatarKind | null) {
      if (k === hovered) return
      hovered = k
      slots.forEach((s) => s.rig?.present(s.kind === k))
    },
    dispose() {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      removeEventListener('pointermove', move)
      removeEventListener('pointerdown', click)
      renderer.dispose()
    },
  }
  return api
}

function splitWords(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.panel h1, .panel h2').forEach((hd) => {
    let i = 0
    const walk = (n: Node) => {
      for (const c of [...n.childNodes]) {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment()
          for (const part of (c.textContent ?? '').split(/(\s+)/)) {
            if (!part) continue
            if (/^\s+$/.test(part)) frag.append(part)
            else {
              const sp = document.createElement('span')
              sp.className = 'w'
              sp.style.setProperty('--i', String(i++))
              sp.textContent = part
              frag.append(sp)
            }
          }
          c.replaceWith(frag)
        } else if (c.nodeType === 1) walk(c)
      }
    }
    walk(hd)
  })
}

function countUp(n: HTMLElement) {
  if (n.dataset.done) return
  n.dataset.done = '1'
  const target = Number(n.dataset.count)
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 1600)
    n.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString()
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
