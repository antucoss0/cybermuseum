import { L } from '../core/i18n'
import type { Content, RoomId } from '../content/types'
import { content } from '../content/store'
import { GEN_2D, paintClone } from '../core/gen2d'
import { putMedia, resolveMedia } from '../core/media'
import { esc, h, money, timeAgo, uid } from '../core/util'
import { payments } from '../payments/bus'

type Field = { k: string; label: string; type?: 'text' | 'number' | 'textarea' | 'select' | 'media' | 'tags' | 'bool' | 'date'; options?: string[] }
type ListKey = 'artworks' | 'products' | 'films' | 'games' | 'events'

const ROOMS: RoomId[] = ['lobby', 'videosala', 'escultura', 'pintura', 'tienda', 'jardin', 'temporales', 'videojuegos', 'futuro']
const GEN_3D = ['liquid', 'knot', 'lattice', 'bust', 'ribbon', 'angel']

const LISTS: Record<ListKey, { title: string; fields: Field[]; blank: () => any }> = {
  artworks: {
    title: L('Obras', 'Artworks'),
    fields: [
      { k: 'title', label: 'Título' },
      { k: 'author', label: 'Artista' },
      { k: 'year', label: 'Año' },
      { k: 'room', label: 'Sala', type: 'select', options: ['pintura', 'escultura', 'temporales'] },
      { k: 'kind', label: 'Tipo', type: 'select', options: ['generative', 'image', 'video', 'model'] },
      { k: 'gen', label: 'Generador', type: 'select', options: [...GEN_2D, ...GEN_3D] },
      { k: 'seed', label: 'Semilla', type: 'number' },
      { k: 'media', label: 'Archivo (imagen / video / .glb)', type: 'media' },
      { k: 'tags', label: 'Etiquetas (coma)', type: 'tags' },
      { k: 'description', label: 'Descripción', type: 'textarea' },
      { k: 'en.title', label: 'Title (EN)' },
      { k: 'en.tags', label: 'Tags (EN, comma)', type: 'tags' },
      { k: 'en.description', label: 'Description (EN)', type: 'textarea' },
    ],
    blank: () => ({ id: uid('a'), room: 'pintura', title: 'Nueva obra', author: '', year: String(new Date().getFullYear()), description: '', tags: [], kind: 'generative', gen: 'nebula', seed: Math.floor(Math.random() * 999) }),
  },
  products: {
    title: L('Tienda', 'Shop'),
    fields: [
      { k: 'name', label: 'Producto' },
      { k: 'category', label: 'Categoría', type: 'select', options: ['stickers', 'ropa', 'prints', 'objetos'] },
      { k: 'price', label: 'Precio MXN', type: 'number' },
      { k: 'gen', label: 'Imagen generativa', type: 'select', options: GEN_2D },
      { k: 'seed', label: 'Semilla', type: 'number' },
      { k: 'media', label: 'Foto del producto', type: 'media' },
      { k: 'description', label: 'Descripción', type: 'textarea' },
      { k: 'en.name', label: 'Product (EN)' },
      { k: 'en.description', label: 'Description (EN)', type: 'textarea' },
    ],
    blank: () => ({ id: uid('pr'), name: 'Nuevo producto', category: 'objetos', price: 100, description: '', gen: 'glyph', seed: Math.floor(Math.random() * 999) }),
  },
  films: {
    title: L('Videosala', 'Screening room'),
    fields: [
      { k: 'title', label: 'Título' },
      { k: 'author', label: 'Autor' },
      { k: 'duration', label: 'Duración (s)', type: 'number' },
      { k: 'gen', label: 'Proyección generativa', type: 'select', options: ['nebula', 'cathedral', 'pulse', 'bloom'] },
      { k: 'media', label: 'Video (mp4 / webm)', type: 'media' },
      { k: 'en.title', label: 'Title (EN)' },
    ],
    blank: () => ({ id: uid('f'), title: 'Nueva proyección', author: '', duration: 60, gen: 'nebula' }),
  },
  games: {
    title: L('Videojuegos', 'Videogames'),
    fields: [
      { k: 'title', label: 'Título' },
      { k: 'kind', label: 'Tipo', type: 'select', options: ['internal', 'url'] },
      { k: 'target', label: 'Destino (stars · synesthesia · URL del juego)' },
      { k: 'open', label: 'Puerta abierta', type: 'bool' },
      { k: 'description', label: 'Descripción', type: 'textarea' },
      { k: 'en.title', label: 'Title (EN)' },
      { k: 'en.description', label: 'Description (EN)', type: 'textarea' },
    ],
    blank: () => ({ id: uid('g'), title: 'Nuevo juego', description: '', kind: 'url', target: '', open: false }),
  },
  events: {
    title: L('Eventos', 'Events'),
    fields: [
      { k: 'title', label: 'Evento' },
      { k: 'date', label: 'Fecha', type: 'date' },
      { k: 'kind', label: 'Tipo', type: 'select', options: ['exposicion', 'lanzamiento', 'curaduria', 'convocatoria', 'concurso'] },
      { k: 'description', label: 'Descripción', type: 'textarea' },
      { k: 'en.title', label: 'Event (EN)' },
      { k: 'en.description', label: 'Description (EN)', type: 'textarea' },
    ],
    blank: () => ({ id: uid('e'), title: 'Nuevo evento', date: new Date().toISOString().slice(0, 10), kind: 'exposicion', description: '' }),
  },
}

const getP = (o: any, k: string) => k.split('.').reduce((a, p) => a?.[p], o)
const setP = (o: any, k: string, v: any) => {
  const ps = k.split('.')
  const last = ps.pop()!
  const t = ps.reduce((a, p) => (a[p] ??= {}), o)
  t[last] = v
}

async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function openAdmin(ui: HTMLElement, onClose: () => void) {
  const el = h('div', { id: 'admin' })
  ui.append(el)
  const close = () => {
    el.remove()
    onClose()
  }
  if (sessionStorage.getItem('cm.admin') === content.data.settings.adminHash) return panel(el, close)
  el.innerHTML = `<div class="login glass"><span class="star">✦</span><h2 class="serif">SuperAdmin</h2><p class="note">${L('Panel curatorial de Cyber Museum. Contraseña demo:', 'Cyber Museum curatorial panel. Demo password:')} <code>cybermuseo</code></p>
    <form><input type="password" placeholder="${L('Contraseña', 'Password')}" autofocus><div class="row"><button class="btn primary">${L('Entrar', 'Sign in')}</button><button type="button" class="btn ghost" data-back>${L('Volver al museo', 'Back to the museum')}</button></div><p class="note err"></p></form></div>`
  el.querySelector('[data-back]')!.addEventListener('click', close)
  el.querySelector('form')!.addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = (el.querySelector('input') as HTMLInputElement).value
    const hash = await sha(v)
    if (hash === content.data.settings.adminHash) {
      sessionStorage.setItem('cm.admin', hash)
      panel(el, close)
    } else (el.querySelector('.err') as HTMLElement).textContent = L('Contraseña incorrecta.', 'Wrong password.')
  })
}

function panel(el: HTMLElement, close: () => void) {
  const tabs = [
    ['resumen', L('Resumen', 'Overview')],
    ['salas', L('Salas', 'Halls')],
    ['artworks', L('Obras', 'Artworks')],
    ['temporal', L('Temporal · Convocatoria', 'Temporary · Open call')],
    ['films', L('Videosala', 'Screening room')],
    ['games', L('Videojuegos', 'Videogames')],
    ['products', L('Tienda', 'Shop')],
    ['events', L('Eventos', 'Events')],
    ['builder', L('Constructor procedural', 'Procedural builder')],
    ['pagos', L('Pagos', 'Payments')],
    ['ajustes', L('Ajustes', 'Settings')],
  ]
  let tab = 'resumen'
  el.innerHTML = `<button class="icon-btn glass menu-toggle">☰</button><aside class="glass"><a class="brand" href="#"><span class="glyph star">✦</span><span><b>CYBER MUSEUM</b><small>SUPERADMIN</small></span></a>
    ${tabs.map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}<button data-exit>← ${L('Volver al museo', 'Back to the museum')}</button></aside><main></main>`
  const main = el.querySelector('main')!
  const aside = el.querySelector('aside')!
  el.querySelector('.menu-toggle')!.addEventListener('click', () => aside.classList.toggle('open'))
  el.querySelector('.brand')!.addEventListener('click', (e) => (e.preventDefault(), close()))
  el.querySelector('[data-exit]')!.addEventListener('click', close)
  aside.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => ((tab = b.dataset.tab!), aside.classList.remove('open'), render())))
  const render = () => {
    aside.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
    main.scrollTop = 0
    if (tab in LISTS) return listView(main, tab as ListKey, render)
    ;(views[tab] ?? views.resumen)(main, render)
  }
  render()
}

const views: Record<string, (m: HTMLElement, rerender: () => void) => void> = {
  resumen(m) {
    const c = content.data
    m.innerHTML = `<h1 class="serif">${L('Resumen', 'Overview')}</h1><p class="lead">Todo lo que edites aquí se aplica al edificio en tiempo real y se guarda en este navegador. Usa Ajustes → Exportar para respaldar o mover el contenido.</p>
      <div class="cards">${[
        ['Obras', c.artworks.length],
        ['Productos', c.products.length],
        ['Eventos', c.events.length],
        ['Propuestas', c.submissions.length],
        ['Pagos', payments.list.length],
        ['Recaudado', money(payments.total())],
      ].map(([k, v]) => `<div class="stat glass"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      <div class="sec glass"><h3 class="serif">Últimos pagos</h3>${payTable(8)}</div>`
  },
  salas(m, rr) {
    const c = content.data
    m.innerHTML = `<h1 class="serif">${L('Salas', 'Halls')}</h1><p class="lead">Abre o cierra alas del edificio y edita sus nombres. Una sala cerrada muestra un velo "Próximamente" en su arco.</p>
      <div class="sec glass"><table><tr><th>${L('Sala', 'Hall')}</th><th>${L('Nombre', 'Name')}</th><th>Name (EN)</th><th>${L('Subtítulo', 'Subtitle')}</th><th>Subtitle (EN)</th><th>${L('Abierta', 'Open')}</th></tr>${ROOMS.filter((r) => r !== 'futuro').map((r) => `<tr><td><code>${r}</code></td><td><input data-r="${r}" data-k="name" value="${esc(c.rooms[r].name)}"></td><td><input data-r="${r}" data-k="en.name" value="${esc(c.rooms[r].en?.name ?? '')}"></td><td><input data-r="${r}" data-k="subtitle" value="${esc(c.rooms[r].subtitle)}"></td><td><input data-r="${r}" data-k="en.subtitle" value="${esc(c.rooms[r].en?.subtitle ?? '')}"></td><td><input type="checkbox" data-r="${r}" data-k="open" ${c.rooms[r].open ? 'checked' : ''} ${r === 'lobby' ? 'disabled' : ''}></td></tr>`).join('')}</table>
      <div class="row" style="margin-top:12px"><button class="btn primary sm" data-save>Guardar salas</button></div></div>`
    m.querySelector('[data-save]')!.addEventListener('click', () => {
      content.update((d) => m.querySelectorAll<HTMLInputElement>('[data-r]').forEach((i) => {
        setP(d.rooms[i.dataset.r as RoomId], i.dataset.k!, i.type === 'checkbox' ? i.checked : i.value)
      }))
      rr()
    })
  },
  temporal(m, rr) {
    const t = content.data.temp
    m.innerHTML = `<h1 class="serif">${L('Exposición temporal y convocatoria', 'Temporary exhibition and open call')}</h1>
      <div class="sec glass"><div class="fgrid">
        <label>Título de la exposición<input data-k="title" value="${esc(t.title)}"></label>
        <label>Curaduría<input data-k="curator" value="${esc(t.curator)}"></label>
        <label>Título de la convocatoria<input data-k="callTitle" value="${esc(t.callTitle)}"></label>
        <label>Cierre<input data-k="callDeadline" value="${esc(t.callDeadline)}"></label>
        <label style="grid-column:1/-1">${L('Texto curatorial', 'Curatorial text')}<textarea data-k="statement">${esc(t.statement)}</textarea></label>
        <label>Title (EN)<input data-k="en.title" value="${esc(t.en?.title ?? '')}"></label>
        <label>Open call title (EN)<input data-k="en.callTitle" value="${esc(t.en?.callTitle ?? '')}"></label>
        <label style="grid-column:1/-1">Curatorial text (EN)<textarea data-k="en.statement">${esc(t.en?.statement ?? '')}</textarea></label>
        <label><span><input type="checkbox" data-k="callOpen" ${t.callOpen ? 'checked' : ''}> Convocatoria abierta</span></label>
      </div><div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button></div></div>
      <div class="sec glass"><h3 class="serif">Propuestas recibidas (${content.data.submissions.length})</h3>
      <table><tr><th>Fecha</th><th>Nombre</th><th>Propuesta</th><th>Link</th><th></th></tr>${content.data.submissions.map((s) => `<tr><td>${timeAgo(s.at)}</td><td>${esc(s.name)}<br><small>${esc(s.email)}</small></td><td><b>${esc(s.title)}</b><br><small>${esc(s.message)}</small></td><td>${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener">abrir</a>` : ''}</td><td><button class="btn sm ghost" data-del="${s.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="5">Aún no hay propuestas.</td></tr>'}</table></div>`
    m.querySelector('[data-save]')!.addEventListener('click', () => {
      content.update((d) => m.querySelectorAll<HTMLInputElement>('.fgrid [data-k]').forEach((i) => setP(d.temp, i.dataset.k!, i.type === 'checkbox' ? i.checked : i.value)))
      rr()
    })
    m.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => (b.onclick = () => (content.update((d) => (d.submissions = d.submissions.filter((s) => s.id !== b.dataset.del))), rr())))
  },
  builder(m, rr) {
    const s = content.data.settings
    m.innerHTML = `<h1 class="serif">${L('Constructor procedural', 'Procedural builder')}</h1><p class="lead">Genera el ala vacía del edificio a partir de una semilla. Cambia la paleta del universo visible por los ventanales.</p>
      <div class="sec glass"><div class="fgrid">
        <label>Nombre del espacio<input data-k="futureName" value="${esc(s.futureName)}"></label>
        <label>Tipología<select data-k="futureKind">${['mirador', 'santuario', 'archivo'].map((k) => `<option ${k === s.futureKind ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Semilla<input type="number" data-k="seed" value="${s.seed}"></label>
        <label>Paleta del universo<select data-k="palette">${['lavanda', 'aurora', 'abismo', 'solar'].map((k) => `<option ${k === s.palette ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label><span><input type="checkbox" data-k="futureOpen" ${s.futureOpen ? 'checked' : ''}> Construir y abrir al público</span></label>
      </div><div class="row"><button class="btn sm" data-rand>Semilla aleatoria</button><button class="btn primary sm" data-save>Construir</button></div></div>
      <div class="sec glass"><h3 class="serif">Vista previa de la semilla</h3><div class="minimap"></div></div>`
    const prev = () => {
      const seed = Number((m.querySelector('[data-k="seed"]') as HTMLInputElement).value) || 1
      const mm = m.querySelector('.minimap')!
      mm.innerHTML = ''
      GEN_2D.slice(0, 4).forEach((g, i) => mm.append(paintClone(g, seed + i, 160)))
    }
    prev()
    m.querySelector('[data-k="seed"]')!.addEventListener('input', prev)
    m.querySelector('[data-rand]')!.addEventListener('click', () => (((m.querySelector('[data-k="seed"]') as HTMLInputElement).value = String(Math.floor(Math.random() * 99999))), prev()))
    m.querySelector('[data-save]')!.addEventListener('click', () => {
      content.update((d) => m.querySelectorAll<HTMLInputElement>('[data-k]').forEach((i) => {
        const k = i.dataset.k!
        ;(d.settings as any)[k] = i.type === 'checkbox' ? i.checked : k === 'seed' ? Number(i.value) || 1 : i.value
      }))
      rr()
    })
  },
  pagos(m, rr) {
    const s = content.data.settings
    m.innerHTML = `<h1 class="serif">${L('Pagos', 'Payments')}</h1><p class="lead">Cada pago confirmado se emite al bus de pagos: enciende la nube gaussiana, cambia la luz del edificio, genera ondas en el piso y planta una flor en el jardín, en todos los visitantes conectados.</p>
      <div class="sec glass"><h3 class="serif">Simulador</h3><div class="row">${[20, 100, 500, 2000].map((a) => `<button class="btn sm" data-sim="${a}">Simular ${money(a)}</button>`).join('')}<button class="btn sm" data-burst>Ráfaga ×10</button></div></div>
      <div class="sec glass"><h3 class="serif">Integración pey (siguiente fase)</h3>
        <p class="note">El navegador nunca guarda la API key. Un backend propio expone <code>POST /checkout</code> (llama a <code>api.pey.mx/codi/qr</code> o <code>/payment-link/create</code>) y <code>GET /events</code> (SSE con los webhooks <code>codi.qr.payment_received</code> / <code>payment_link.status_updated</code> validados). Deja vacío para usar el modo demo.</p>
        <div class="row"><input data-backend placeholder="https://api.tu-backend.mx" value="${esc(s.peyBackend)}" style="flex:1"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button></div></div>
      <div class="sec glass"><h3 class="serif">Historial</h3>${payTable(60)}<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-clear>Borrar historial</button></div></div>`
    const names = ['Lía', 'Kai', 'Mara', 'Noa', 'Iker', 'Vera', 'Antu', 'Sol']
    const sim = (a: number) => payments.ingest(payments.make(a, 'Donación simulada', 'donacion', names[Math.floor(Math.random() * names.length)], 'sim'))
    m.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach((b) => (b.onclick = () => (sim(Number(b.dataset.sim)), rr())))
    m.querySelector('[data-burst]')!.addEventListener('click', () => {
      for (let i = 0; i < 10; i++) setTimeout(() => sim(20 + Math.floor(Math.random() * 400)), i * 350)
      setTimeout(rr, 3800)
    })
    m.querySelector('[data-save]')!.addEventListener('click', () => (content.update((d) => (d.settings.peyBackend = (m.querySelector('[data-backend]') as HTMLInputElement).value.trim())), rr()))
    m.querySelector('[data-clear]')!.addEventListener('click', () => confirm('¿Borrar historial de pagos?') && (payments.clear(), rr()))
  },
  ajustes(m, rr) {
    const s = content.data.settings
    m.innerHTML = `<h1 class="serif">${L('Ajustes', 'Settings')}</h1>
      <div class="sec glass"><h3 class="serif">Multijugador</h3><div class="fgrid">
        <label><span><input type="checkbox" data-k="multiplayer" ${s.multiplayer ? 'checked' : ''}> Activar multijugador P2P</span></label>
        <label>Nombre de la sala de red<input data-k="roomName" value="${esc(s.roomName)}"></label>
      </div><div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button></div></div>
      <div class="sec glass"><h3 class="serif">Contraseña</h3><div class="row"><input type="password" data-pw placeholder="Nueva contraseña"><button class="btn sm" data-setpw>Cambiar</button></div><p class="note">Protección local de demo. Para producción, el panel deberá autenticarse contra el backend.</p></div>
      <div class="sec glass"><h3 class="serif">Respaldo</h3><div class="row"><button class="btn sm" data-export>Exportar JSON</button><label class="btn sm">Importar JSON<input type="file" accept="application/json" data-import hidden></label><button class="btn sm ghost" data-reset>Restaurar contenido original</button></div></div>`
    m.querySelector('[data-save]')!.addEventListener('click', () => {
      content.update((d) => m.querySelectorAll<HTMLInputElement>('[data-k]').forEach((i) => ((d.settings as any)[i.dataset.k!] = i.type === 'checkbox' ? i.checked : i.value)))
      rr()
    })
    m.querySelector('[data-setpw]')!.addEventListener('click', async () => {
      const v = (m.querySelector('[data-pw]') as HTMLInputElement).value
      if (v.length < 4) return alert('Mínimo 4 caracteres')
      const hsh = await sha(v)
      content.update((d) => (d.settings.adminHash = hsh))
      sessionStorage.setItem('cm.admin', hsh)
      alert('Contraseña actualizada')
    })
    m.querySelector('[data-export]')!.addEventListener('click', () => {
      const a = h('a', { href: URL.createObjectURL(new Blob([content.export()], { type: 'application/json' })), download: 'cyber-museum-content.json' })
      a.click()
    })
    m.querySelector('[data-import]')!.addEventListener('change', async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      try {
        content.replace(JSON.parse(await f.text()) as Content)
        rr()
      } catch {
        alert('Archivo inválido')
      }
    })
    m.querySelector('[data-reset]')!.addEventListener('click', () => confirm('¿Restaurar el contenido original? Se perderán tus cambios.') && (content.reset(), rr()))
  },
}

function payTable(n: number) {
  const list = payments.list.slice(0, n)
  if (!list.length) return '<p class="note">Aún no hay pagos.</p>'
  return `<table><tr><th>Cuándo</th><th>Quién</th><th>Concepto</th><th>Origen</th><th>Monto</th></tr>${list.map((p) => `<tr><td>${timeAgo(p.at)}</td><td>${esc(p.payer)}</td><td>${esc(p.concept)}</td><td><code>${p.source}</code></td><td>${money(p.amount)}</td></tr>`).join('')}</table>`
}

function listView(m: HTMLElement, key: ListKey, rr: () => void) {
  const def = LISTS[key]
  const list = content.data[key] as any[]
  m.innerHTML = `<h1 class="serif">${def.title}</h1><div class="row" style="margin-bottom:14px"><button class="btn primary sm" data-add>+ ${L('Añadir', 'Add')}</button></div><div class="items"></div>`
  const items = m.querySelector('.items')!
  list.forEach((it, idx) => {
    const sec = h('div', { class: 'sec glass' })
    sec.innerHTML = `<div class="row" style="justify-content:space-between"><h3 class="serif">${esc(it.title ?? it.name)}${it.en?.title || it.en?.name ? ` <small class="note">· ${esc(it.en.title ?? it.en.name)}</small>` : ''}</h3><div class="row"><div class="thumb"></div><button class="btn sm ghost" data-up>↑</button><button class="btn sm ghost" data-del>${L('Eliminar', 'Delete')}</button></div></div>
      <div class="fgrid">${def.fields.map((f) => field(f, getP(it, f.k))).join('')}</div><div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button><span class="note" data-msg></span></div>`
    items.append(sec)
    const th = sec.querySelector('.thumb')!
    if (it.media) resolveMedia(it.media).then((u) => u && it.kind !== 'video' && it.kind !== 'model' && th.append(h('img', { src: u, style: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' } })))
    else if (it.gen && GEN_2D.includes(it.gen)) {
      const c = paintClone(it.gen, it.seed ?? 1, 96)
      c.style.cssText = 'width:48px;height:48px;border-radius:8px'
      th.append(c)
    }
    sec.querySelector('[data-save]')!.addEventListener('click', async () => {
      const next = structuredClone(it)
      for (const f of def.fields) {
        const i = sec.querySelector(`[data-f="${f.k}"]`) as HTMLInputElement
        if (f.type === 'media') {
          const file = i.files?.[0]
          if (file) {
            ;(sec.querySelector('[data-msg]') as HTMLElement).textContent = 'Subiendo…'
            next.media = await putMedia(file)
            if (key === 'artworks' && next.kind === 'generative') next.kind = file.type.startsWith('video') ? 'video' : /gltf|glb/.test(file.name) ? 'model' : 'image'
          }
          if ((sec.querySelector(`[data-clear="${f.k}"]`) as HTMLInputElement)?.checked) delete next.media
        } else if (f.type === 'number') setP(next, f.k, Number(i.value))
        else if (f.type === 'bool') setP(next, f.k, i.checked)
        else if (f.type === 'tags') setP(next, f.k, i.value.split(',').map((s) => s.trim()).filter(Boolean))
        else setP(next, f.k, i.value)
      }
      content.update((d) => ((d[key] as any[])[idx] = next))
      rr()
    })
    sec.querySelector('[data-del]')!.addEventListener('click', () => confirm('¿Eliminar?') && (content.update((d) => (d[key] as any[]).splice(idx, 1)), rr()))
    sec.querySelector('[data-up]')!.addEventListener('click', () => {
      if (idx === 0) return
      content.update((d) => {
        const a = d[key] as any[]
        ;[a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]
      })
      rr()
    })
  })
  m.querySelector('[data-add]')!.addEventListener('click', () => (content.update((d) => (d[key] as any[]).unshift(def.blank())), rr()))
}

function field(f: Field, v: any) {
  const a = `data-f="${f.k}"`
  switch (f.type) {
    case 'textarea':
      return `<label style="grid-column:1/-1">${f.label}<textarea ${a}>${esc(v ?? '')}</textarea></label>`
    case 'select':
      return `<label>${f.label}<select ${a}>${(f.options ?? []).map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`
    case 'number':
      return `<label>${f.label}<input type="number" ${a} value="${v ?? 0}"></label>`
    case 'date':
      return `<label>${f.label}<input type="date" ${a} value="${esc(v ?? '')}"></label>`
    case 'bool':
      return `<label><span><input type="checkbox" ${a} ${v ? 'checked' : ''}> ${f.label}</span></label>`
    case 'tags':
      return `<label>${f.label}<input ${a} value="${esc((v ?? []).join(', '))}"></label>`
    case 'media':
      return `<label>${f.label}<input type="file" ${a} accept="image/*,video/*,.glb,.gltf">${v ? `<span class="note"><input type="checkbox" data-clear="${f.k}"> quitar archivo actual</span>` : ''}</label>`
    default:
      return `<label>${f.label}<input ${a} value="${esc(v ?? '')}"></label>`
  }
}
