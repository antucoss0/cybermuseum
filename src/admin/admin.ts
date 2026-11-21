import { L } from '../core/i18n'
import type { Content, RoomId } from '../content/types'
import { content } from '../content/store'
import { GEN_2D, paintClone } from '../core/gen2d'
import { resolveMedia, uploadMedia } from '../core/media'
import { aboutView, callsView, forumView, hallsView, meetingsView, revenueView, statsView } from './v2'
import { esc, h, money, timeAgo, uid } from '../core/util'
import { payments, type PaymentEvent } from '../payments/bus'
import { DEFAULT_ADMIN_HASH } from '../content/defaults'

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
      { k: 'model', label: 'Modelo 3D (URL .glb)' },
      { k: 'link', label: 'Link externo / marketplace' },
      { k: 'pod', label: 'Print-on-demand (SKU / proveedor)' },
      { k: 'visible', label: 'Visible', type: 'bool' },
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
      { k: 'category', label: 'Categoría', type: 'select', options: ['Cortos', 'Videoarte', 'Videoclips', 'Documental', 'Estrenos', 'Publicidad'] },
      { k: 'year', label: 'Año' },
      { k: 'schedule', label: 'Horario (ej. Vie 20:00)' },
      { k: 'ad', label: 'Es publicidad (se proyecta entre programas)', type: 'bool' },
      { k: 'visible', label: 'Visible', type: 'bool' },
      { k: 'synopsis', label: 'Sinopsis', type: 'textarea' },
      { k: 'en.title', label: 'Title (EN)' },
      { k: 'en.synopsis', label: 'Synopsis (EN)', type: 'textarea' },
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
  if (sessionStorage.getItem('cm.admin') === DEFAULT_ADMIN_HASH) return panel(el, close)
  el.innerHTML = `<div class="login glass"><span class="star">✦</span><h2 class="serif">SuperAdmin</h2><p class="note">${L('Introduce el PIN de acceso', 'Enter the access PIN')}</p>
    <div class="pin">${'<i></i>'.repeat(4)}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => (k === '' ? '<span></span>' : `<button type="button" data-k="${k}">${k}</button>`)).join('')}</div>
    <p class="note err"></p><button type="button" class="btn ghost sm" data-back>${L('Volver al museo', 'Back to the museum')}</button></div>`
  el.querySelector('[data-back]')!.addEventListener('click', close)
  let pin = ''
  const dots = el.querySelectorAll('.pin i')
  const press = async (k: string) => {
    if (k === '⌫') pin = pin.slice(0, -1)
    else if (/^\d$/.test(k) && pin.length < 4) pin += k
    dots.forEach((d, i) => d.classList.toggle('on', i < pin.length))
    if (pin.length < 4) return
    const hash = await sha(pin)
    if (hash === DEFAULT_ADMIN_HASH) {
      sessionStorage.setItem('cm.admin', hash)
      sessionStorage.setItem('cm.adminPin', pin)
      window.removeEventListener('keydown', onKey)
      panel(el, close)
    } else {
      ;(el.querySelector('.err') as HTMLElement).textContent = L('PIN incorrecto.', 'Wrong PIN.')
      el.querySelector('.pin')!.classList.add('shake')
      setTimeout(() => el.querySelector('.pin')?.classList.remove('shake'), 500)
      pin = ''
      dots.forEach((d) => d.classList.remove('on'))
    }
  }
  const onKey = (e: KeyboardEvent) => {
    if (/^\d$/.test(e.key)) press(e.key)
    else if (e.key === 'Backspace') press('⌫')
  }
  window.addEventListener('keydown', onKey)
  el.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => (b.onclick = () => press(b.dataset.k!)))
}

function panel(el: HTMLElement, close: () => void) {
  const tabs = [
    ['stats', L('Estadísticas', 'Statistics')],
    ['h-temporal', L('Exposiciones temporales', 'Temporary exhibitions')],
    ['h-2d', L('Sala 2D', '2D Hall')],
    ['h-3d', L('Sala 3D', '3D Hall')],
    ['h-games', L('Videojuegos', 'Videogames')],
    ['games', L('Puertas de juego', 'Game doors')],
    ['products', L('Tienda', 'Shop')],
    ['forum', L('Foro', 'Forum')],
    ['films', L('Videosala', 'Screening room')],
    ['calls', L('Convocatorias', 'Open calls')],
    ['solicitudes', L('Postulaciones', 'Applications')],
    ['about', 'About'],
    ['meetings', L('Sala de juntas', 'Meeting room')],
    ['salas', L('Alas del edificio', 'Building wings')],
    ['artworks', L('Obras permanentes', 'Permanent works')],
    ['events', L('Agenda', 'Calendar')],
    ['builder', L('Constructor procedural', 'Procedural builder')],
    ['revenue', L('Ingresos 🔒', 'Revenue 🔒')],
    ['ajustes', L('Ajustes', 'Settings')],
  ]
  let tab = 'stats'
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
    delete main.dataset.open
    delete main.dataset.synced
    if (tab in LISTS) return listView(main, tab as ListKey, render)
    if (tab.startsWith('h-')) return hallsView(tab.slice(2) as any)(main, render)
    ;(views[tab] ?? views.resumen)(main, render)
  }
  render()
}

const views: Record<string, (m: HTMLElement, rerender: () => void) => void> = {
  resumen(m) {
    const c = content.data
    const pend = c.submissions.filter((x) => (x.status ?? 'pendiente') === 'pendiente').length
    const today = payments.list.filter((p) => Date.now() - p.at < 864e5)
    m.innerHTML = `<h1 class="serif">${L('Resumen', 'Overview')}</h1><p class="lead">${L('Todo lo que edites aquí se aplica al edificio en tiempo real. Usa Ajustes → Exportar para respaldar o mover el contenido.', 'Everything you edit here is applied to the building in real time. Use Settings → Export to back up or move content.')}</p>
      <div class="cards">${[
        [L('Ingresos totales', 'Total revenue'), money(payments.total())],
        [L('Últimas 24 h', 'Last 24 h'), money(today.reduce((s, p) => s + p.amount, 0))],
        [L('Pagos', 'Payments'), payments.list.length],
        [L('Ticket promedio', 'Average ticket'), money(payments.list.length ? payments.total() / payments.list.length : 0)],
        [L('Solicitudes pendientes', 'Pending submissions'), pend],
        [L('Obras', 'Artworks'), c.artworks.length],
      ].map(([k, v]) => `<div class="stat glass"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      ${revenueCharts(payments.list)}
      <div class="sec glass"><h3 class="serif">${L('Últimos pagos', 'Latest payments')}</h3>${payTable(8)}</div>`
  },
  solicitudes(m, rr) {
    if (!m.dataset.synced) {
      m.dataset.synced = '1'
      fetch('./api/submit', { headers: { 'x-admin-pin': sessionStorage.getItem('cm.adminPin') ?? '' }, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const have = new Set(content.data.submissions.map((x) => x.id))
          const fresh = ((j?.items ?? []) as typeof content.data.submissions).filter((x) => !have.has(x.id))
          if (fresh.length) (content.update((d) => d.submissions.unshift(...fresh.sort((a, b) => b.at - a.at))), rr())
        })
        .catch(() => {})
    }
    const subs = content.data.submissions
    let filter = (m.dataset.filter as string) || 'todas'
    const count = (st: string) => subs.filter((s) => (s.status ?? 'pendiente') === st).length
    const shown = subs.filter((s) => filter === 'todas' || (s.status ?? 'pendiente') === filter)
    m.innerHTML = `<h1 class="serif">${L('Solicitudes de convocatoria', 'Open call submissions')}</h1><p class="lead">${L('Revisa, aprueba o rechaza las propuestas que llegan desde el kiosco de convocatorias del lobby.', 'Review, approve or reject proposals sent from the Temporary Exhibitions hall.')}</p>
      <div class="row" style="margin-bottom:14px">${[['todas', L('Todas', 'All'), subs.length], ['pendiente', L('Pendientes', 'Pending'), count('pendiente')], ['aprobada', L('Aprobadas', 'Approved'), count('aprobada')], ['rechazada', L('Rechazadas', 'Rejected'), count('rechazada')]].map(([k, l, n]) => `<button class="btn sm ${filter === k ? 'primary' : ''}" data-filter="${k}">${l} · ${n}</button>`).join('')}</div>
      <div class="subs">${shown.map((s) => `<div class="sub sec glass st-${s.status ?? 'pendiente'}"><div class="row" style="justify-content:space-between"><div><span class="kicker">${timeAgo(s.at)} · ${esc(s.status ?? 'pendiente')}</span><h3 class="serif">${esc(s.title)}</h3><small>${esc(s.name)} · <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>${s.link ? ` · <a href="${esc(s.link)}" target="_blank" rel="noopener">${L('portafolio', 'portfolio')}</a>` : ''}</small></div>
        <div class="row"><button class="btn sm" data-st="aprobada" data-id="${s.id}">✓ ${L('Aprobar', 'Approve')}</button><button class="btn sm ghost" data-st="rechazada" data-id="${s.id}">✕ ${L('Rechazar', 'Reject')}</button><button class="btn sm ghost" data-st="pendiente" data-id="${s.id}">↺</button><button class="btn sm ghost" data-del="${s.id}">${L('Eliminar', 'Delete')}</button></div></div>
        <p class="note" style="margin:10px 0">${esc(s.message)}</p><div class="row"><input data-note="${s.id}" placeholder="${L('Nota curatorial interna', 'Internal curatorial note')}" value="${esc(s.note ?? '')}" style="flex:1"><button class="btn sm" data-savenote="${s.id}">${L('Guardar nota', 'Save note')}</button></div></div>`).join('') || `<p class="note">${L('No hay solicitudes en esta vista.', 'No submissions in this view.')}</p>`}</div>`
    m.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => (b.onclick = () => ((m.dataset.filter = b.dataset.filter!), rr())))
    m.querySelectorAll<HTMLButtonElement>('[data-st]').forEach((b) => (b.onclick = () => (content.update((d) => { const x = d.submissions.find((s) => s.id === b.dataset.id); if (x) x.status = b.dataset.st as any }), rr())))
    m.querySelectorAll<HTMLButtonElement>('[data-savenote]').forEach((b) => (b.onclick = () => content.update((d) => { const x = d.submissions.find((s) => s.id === b.dataset.savenote); if (x) x.note = (m.querySelector(`[data-note="${b.dataset.savenote}"]`) as HTMLInputElement).value })))
    m.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => (b.onclick = () => confirm(L('¿Eliminar?', 'Delete?')) && (content.update((d) => (d.submissions = d.submissions.filter((s) => s.id !== b.dataset.del))), rr())))
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
  stats: (m) => statsView(m),
  calls: callsView,
  forum: forumView,
  meetings: meetingsView,
  about: aboutView,
  revenue: (m, rr) => revenueView(() => revenueCharts(payments.list), payTable)(m, rr),
  ajustes(m, rr) {
    const s = content.data.settings
    m.innerHTML = `<h1 class="serif">${L('Ajustes', 'Settings')}</h1>
      <div class="sec glass"><h3 class="serif">Multijugador</h3><div class="fgrid">
        <label><span><input type="checkbox" data-k="multiplayer" ${s.multiplayer ? 'checked' : ''}> Activar multijugador P2P</span></label>
        <label>Nombre de la sala de red<input data-k="roomName" value="${esc(s.roomName)}"></label>
      </div><div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button></div></div>
      <div class="sec glass"><h3 class="serif">Respaldo</h3><div class="row"><button class="btn sm" data-export>Exportar JSON</button><label class="btn sm">Importar JSON<input type="file" accept="application/json" data-import hidden></label><button class="btn sm ghost" data-reset>Restaurar contenido original</button></div></div>`
    m.querySelector('[data-save]')!.addEventListener('click', () => {
      content.update((d) => m.querySelectorAll<HTMLInputElement>('[data-k]').forEach((i) => ((d.settings as any)[i.dataset.k!] = i.type === 'checkbox' ? i.checked : i.value)))
      rr()
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


const PURPOSE_COLORS: Record<string, string> = { donacion: '#b89cff', tienda: '#7cf2e4', jardin: '#ff9be9', entrada: '#8fb4ff' }
function revenueCharts(list: PaymentEvent[]) {
  const days = 14
  const day0 = new Date()
  day0.setHours(0, 0, 0, 0)
  const buckets = Array.from({ length: days }, (_, i) => ({ t: day0.getTime() - (days - 1 - i) * 864e5, v: 0, n: 0 }))
  for (const p of list) {
    const i = Math.floor((p.at - buckets[0].t) / 864e5)
    if (i >= 0 && i < days) ((buckets[i].v += p.amount), buckets[i].n++)
  }
  const W = 640, H = 200, pad = 30
  const max = Math.max(100, ...buckets.map((b) => b.v))
  const x = (i: number) => pad + (i * (W - pad * 2)) / (days - 1)
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const pts = buckets.map((b, i) => `${x(i).toFixed(1)},${y(b.v).toFixed(1)}`).join(' ')
  const area = `${x(0)},${H - pad} ${pts} ${x(days - 1)},${H - pad}`
  const grid = [0, 0.5, 1].map((f) => `<line x1="${pad}" x2="${W - pad}" y1="${y(max * f)}" y2="${y(max * f)}" class="g"/><text x="4" y="${y(max * f) + 3}">${Math.round(max * f)}</text>`).join('')
  const labels = buckets.map((b, i) => (i % 2 ? '' : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${new Date(b.t).getDate()}/${new Date(b.t).getMonth() + 1}</text>`)).join('')
  const dots = buckets.map((b, i) => `<circle cx="${x(i)}" cy="${y(b.v)}" r="3"><title>${money(b.v)} · ${b.n}</title></circle>`).join('')
  const by: Record<string, number> = {}
  for (const p of list) by[p.purpose] = (by[p.purpose] ?? 0) + p.amount
  const total = Object.values(by).reduce((a, b) => a + b, 0) || 1
  let acc = 0
  const R = 60, C = 2 * Math.PI * R
  const arcs = Object.entries(by).map(([k, v]) => {
    const len = (v / total) * C
    const s = `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${PURPOSE_COLORS[k] ?? '#fff'}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 80 80)"><title>${k}: ${money(v)}</title></circle>`
    acc += len
    return s
  }).join('')
  const legend = Object.entries(by).map(([k, v]) => `<div><i style="background:${PURPOSE_COLORS[k] ?? '#fff'}"></i>${k} <b>${money(v)}</b> <small>${Math.round((v / total) * 100)}%</small></div>`).join('')
  const hours = Array.from({ length: 24 }, () => 0)
  for (const p of list) hours[new Date(p.at).getHours()] += p.amount
  const hm = Math.max(1, ...hours)
  const bars = hours.map((v, i) => `<rect x="${i * 13 + 2}" y="${100 - (v / hm) * 90}" width="10" height="${(v / hm) * 90 + 1}" rx="2"><title>${i}:00 · ${money(v)}</title></rect>`).join('')
  return `<div class="charts"><div class="sec glass chart"><h3 class="serif">${L('Ingresos · últimos 14 días', 'Revenue · last 14 days')}</h3><svg viewBox="0 0 ${W} ${H}" class="line"><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b89cff" stop-opacity=".55"/><stop offset="1" stop-color="#b89cff" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#rg)"/><polyline points="${pts}" fill="none" stroke="#c9b3ff" stroke-width="2"/>${dots}${labels}</svg></div>
    <div class="sec glass chart"><h3 class="serif">${L('Por concepto', 'By purpose')}</h3><div class="donut"><svg viewBox="0 0 160 160">${arcs || `<circle r="${R}" cx="80" cy="80" fill="none" stroke="#2a2440" stroke-width="18"/>`}<text x="80" y="86" text-anchor="middle" class="big">${money(total === 1 && !list.length ? 0 : total)}</text></svg><div class="legend">${legend || `<small class="note">${L('Sin datos aún', 'No data yet')}</small>`}</div></div></div>
    <div class="sec glass chart"><h3 class="serif">${L('Hora del día', 'Hour of day')}</h3><svg viewBox="0 0 314 112" class="bars">${bars}<text x="2" y="111">0h</text><text x="150" y="111">12h</text><text x="290" y="111">23h</text></svg></div></div>`
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
            next.media = await uploadMedia(file, (p) => ((sec.querySelector('[data-msg]') as HTMLElement).textContent = Math.round(p) + '%'))
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
