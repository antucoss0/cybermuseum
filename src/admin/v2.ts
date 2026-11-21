import { L } from '../core/i18n'
import type { Asset, Hall, HallKind, Piece } from '../content/types'
import { content } from '../content/store'
import { assetKind, uploadMedia } from '../core/media'
import { esc, money, timeAgo, uid } from '../core/util'
import { payments } from '../payments/bus'

type R = () => void
const KIND_LABEL: Record<HallKind, string> = { temporal: L('Exposiciones temporales', 'Temporary exhibitions'), '2d': L('Sala 2D · Ilustración', '2D Hall · Illustration'), '3d': L('Sala 3D', '3D Hall'), games: L('Videojuegos e interactividad', 'Videogames & interactivity') }
const val = (root: ParentNode, sel: string) => (root.querySelector(sel) as HTMLInputElement | null)?.value ?? ''
const inp = (k: string, label: string, v: string | number = '', type = 'text', wide = false) => `<label${wide ? ' style="grid-column:1/-1"' : ''}>${label}${type === 'textarea' ? `<textarea data-k="${k}">${esc(String(v ?? ''))}</textarea>` : `<input type="${type}" data-k="${k}" value="${esc(String(v ?? ''))}">`}</label>`
const box = (k: string, label: string, on: boolean) => `<label><span><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}> ${label}</span></label>`

function assetsEditor(list: Asset[]) {
  return `<div class="assets" data-assets>${list.map((a, i) => `<div class="asset"><code>${a.kind}</code> <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name || a.url.split('/').pop() || a.url)}</a> <button class="btn sm ghost" data-rmasset="${i}">✕</button></div>`).join('') || `<small class="note">${L('Sin archivos', 'No files')}</small>`}</div>
    <div class="row"><label class="btn sm">${L('Subir archivos', 'Upload files')} (img · mp4 · gif · glb/gltf/fbx/obj)<input type="file" multiple hidden data-upfiles accept="image/*,video/*,audio/*,.glb,.gltf,.fbx,.obj,.ply,.usdz"></label><input data-linkurl placeholder="https://… (link, YouTube, Sketchfab)" style="flex:1"><button class="btn sm" data-addlink>+ link</button><span class="note" data-upmsg></span></div>`
}

/** Wires an assets editor; mutates `list` and calls `done` after each change. */
function wireAssets(root: HTMLElement, list: Asset[], done: () => void) {
  root.querySelectorAll<HTMLButtonElement>('[data-rmasset]').forEach((b) => (b.onclick = () => (list.splice(Number(b.dataset.rmasset), 1), done())))
  const msg = root.querySelector('[data-upmsg]') as HTMLElement
  root.querySelector('[data-upfiles]')?.addEventListener('change', async (e) => {
    const files = [...((e.target as HTMLInputElement).files ?? [])]
    for (const f of files) {
      msg.textContent = `${L('Subiendo', 'Uploading')} ${f.name}…`
      const url = await uploadMedia(f, (p) => (msg.textContent = `${f.name} ${Math.round(p)}%`))
      list.push({ kind: assetKind(f.name, f.type), url, name: f.name })
    }
    done()
  })
  root.querySelector('[data-addlink]')?.addEventListener('click', () => {
    const url = val(root, '[data-linkurl]').trim()
    if (url) (list.push({ kind: assetKind(url), url }), done())
  })
}

export function hallsView(kind: HallKind) {
  return (m: HTMLElement, rr: R) => {
    const halls = content.data.halls.filter((x) => x.kind === kind)
    const open = m.dataset.open || ''
    m.innerHTML = `<h1 class="serif">${KIND_LABEL[kind]}</h1><p class="lead">${L('Cada sala aparece como una puerta-portal en el ala correspondiente del museo.', 'Each hall appears as a portal door in its wing of the museum.')}${kind === 'games' ? L(' Si defines un link externo, la puerta abre ese sitio.', ' If you set an external link, the door opens that site.') : ''}</p>
      <div class="row" style="margin-bottom:14px"><button class="btn primary sm" data-addhall>+ ${L('Crear sala', 'Create hall')}</button></div>
      ${halls.map((hl) => `<div class="sec glass hall" data-hall="${hl.id}"><div class="row" style="justify-content:space-between"><h3 class="serif"><i class="dot" style="background:${esc(hl.color)}"></i>${esc(hl.name)} <small class="note">${hl.pieces.length} ${L('piezas', 'pieces')} · ${hl.visible ? L('visible', 'visible') : L('oculta', 'hidden')}</small></h3>
        <div class="row"><button class="btn sm" data-toggle="${hl.id}">${open === hl.id ? L('Cerrar', 'Close') : L('Editar', 'Edit')}</button><button class="btn sm ghost" data-delhall="${hl.id}">${L('Eliminar', 'Delete')}</button></div></div>
        ${open === hl.id ? hallForm(hl) : ''}</div>`).join('') || `<p class="note">${L('Aún no hay salas.', 'No halls yet.')}</p>`}`
    m.querySelector('[data-addhall]')!.addEventListener('click', () => {
      const id = uid('h')
      content.update((d) => d.halls.unshift({ id, kind, name: L('Nueva sala', 'New hall'), theme: '', curatorial: '', color: '#b89cff', visible: false, pieces: [] }))
      m.dataset.open = id
      rr()
    })
    m.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => (b.onclick = () => ((m.dataset.open = open === b.dataset.toggle ? '' : b.dataset.toggle!), rr())))
    m.querySelectorAll<HTMLButtonElement>('[data-delhall]').forEach((b) => (b.onclick = () => confirm(L('¿Eliminar sala y sus piezas?', 'Delete hall and its pieces?')) && (content.update((d) => (d.halls = d.halls.filter((x) => x.id !== b.dataset.delhall))), rr())))
    const sec = m.querySelector(`[data-hall="${open}"]`) as HTMLElement | null
    const hall = content.data.halls.find((x) => x.id === open)
    if (sec && hall) wireHall(sec, hall, rr)
  }
}

function hallForm(hl: Hall) {
  const prods = content.data.products
  return `<div class="fgrid" data-hallform>
      ${inp('name', L('Nombre', 'Name'), hl.name)}${inp('theme', L('Temática', 'Theme'), hl.theme)}
      ${inp('color', L('Color de la puerta', 'Door color'), hl.color, 'color')}${box('visible', L('Visible al público', 'Visible to the public'), hl.visible)}
      ${inp('start', L('Inicio', 'Start'), hl.start ?? '', 'date')}${inp('end', L('Fin', 'End'), hl.end ?? '', 'date')}
      ${hl.kind === 'games' ? inp('external', L('Link externo (opcional)', 'External link (optional)'), hl.external ?? '', 'url', true) : ''}
      ${inp('curatorial', L('Texto curatorial', 'Curatorial text'), hl.curatorial, 'textarea', true)}
      ${inp('en.name', 'Name (EN)', hl.en?.name ?? '')}${inp('en.theme', 'Theme (EN)', hl.en?.theme ?? '')}
      ${inp('en.curatorial', 'Curatorial text (EN)', hl.en?.curatorial ?? '', 'textarea', true)}
    </div><div class="row"><button class="btn primary sm" data-savehall>${L('Guardar sala', 'Save hall')}</button></div>
    <h3 class="serif" style="margin-top:18px">${L('Piezas', 'Pieces')}</h3><div class="row"><button class="btn sm" data-addpiece>+ ${L('Añadir pieza', 'Add piece')}</button></div>
    ${hl.pieces.map((p, i) => `<div class="sec piece" data-piece="${i}"><div class="fgrid">
      ${inp('title', L('Nombre de la pieza', 'Piece name'), p.title)}${inp('author', L('Autor', 'Author'), p.author)}${inp('year', L('Año', 'Year'), p.year)}
      ${box('visible', L('Visible', 'Visible'), p.visible)}${box('donation', L('Botón de donación', 'Donation button'), p.donation)}
      <label>${L('Item de tienda', 'Shop item')}<select data-k="productId"><option value="">—</option>${prods.map((x) => `<option value="${x.id}" ${x.id === p.productId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      ${inp('links', L('Links del artista / redes (uno por línea)', 'Artist links / social (one per line)'), p.links, 'textarea', true)}
      ${inp('lore', L('Lore / descripción', 'Lore / description'), p.lore, 'textarea', true)}
      ${inp('en.title', 'Title (EN)', p.en?.title ?? '')}${inp('en.lore', 'Lore (EN)', p.en?.lore ?? '', 'textarea', true)}
      </div>${assetsEditor(p.assets)}<div class="row"><button class="btn primary sm" data-savepiece>${L('Guardar pieza', 'Save piece')}</button><button class="btn sm ghost" data-uppiece>↑</button><button class="btn sm ghost" data-delpiece>${L('Eliminar', 'Delete')}</button></div></div>`).join('')}`
}

const setP = (o: any, k: string, v: any) => {
  const ps = k.split('.')
  const last = ps.pop()!
  ps.reduce((a, p) => (a[p] ??= {}), o)[last] = v
}
function readForm(root: HTMLElement, target: any) {
  root.querySelectorAll<HTMLInputElement>(':scope [data-k]').forEach((i) => setP(target, i.dataset.k!, i.type === 'checkbox' ? i.checked : i.value))
}

function wireHall(sec: HTMLElement, hall: Hall, rr: R) {
  const commit = () => (content.update((d) => (d.halls = d.halls.map((x) => (x.id === hall.id ? hall : x)))), rr())
  sec.querySelector('[data-savehall]')!.addEventListener('click', () => (readForm(sec.querySelector('[data-hallform]')!, hall), commit()))
  sec.querySelector('[data-addpiece]')!.addEventListener('click', () => {
    hall.pieces.push({ id: uid('pc'), title: L('Nueva pieza', 'New piece'), author: '', year: String(new Date().getFullYear()), lore: '', links: '', assets: [], visible: true, donation: true, gen: 'nebula', seed: Math.floor(Math.random() * 999) } as Piece)
    commit()
  })
  sec.querySelectorAll<HTMLElement>('[data-piece]').forEach((el) => {
    const i = Number(el.dataset.piece)
    const p = hall.pieces[i]
    wireAssets(el, p.assets, commit)
    el.querySelector('[data-savepiece]')!.addEventListener('click', () => (readForm(el.querySelector('.fgrid')!, p), commit()))
    el.querySelector('[data-delpiece]')!.addEventListener('click', () => confirm(L('¿Eliminar pieza?', 'Delete piece?')) && (hall.pieces.splice(i, 1), commit()))
    el.querySelector('[data-uppiece]')!.addEventListener('click', () => i > 0 && (([hall.pieces[i - 1], hall.pieces[i]] = [hall.pieces[i], hall.pieces[i - 1]]), commit()))
  })
}

export function callsView(m: HTMLElement, rr: R) {
  const c = content.data
  m.innerHTML = `<h1 class="serif">${L('Convocatorias', 'Open calls')}</h1><p class="lead">${L('Se muestran en el kiosco del lobby. El visitante lee los términos, se registra y aplica.', 'Shown at the lobby kiosk. Visitors read the terms, register and apply.')}</p>
    <div class="row" style="margin-bottom:14px"><button class="btn primary sm" data-add>+ ${L('Publicar convocatoria', 'Publish open call')}</button></div>
    ${c.calls.map((x, i) => `<div class="sec glass" data-i="${i}"><div class="fgrid">${inp('title', L('Título', 'Title'), x.title)}${inp('deadline', L('Cierre', 'Deadline'), x.deadline, 'date')}${box('open', L('Abierta', 'Open'), x.open)}
      ${inp('description', L('Descripción', 'Description'), x.description, 'textarea', true)}${inp('terms', L('Términos y condiciones', 'Terms and conditions'), x.terms, 'textarea', true)}
      ${inp('en.title', 'Title (EN)', x.en?.title ?? '')}${inp('en.description', 'Description (EN)', x.en?.description ?? '', 'textarea', true)}${inp('en.terms', 'Terms (EN)', x.en?.terms ?? '', 'textarea', true)}</div>
      <div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button><button class="btn sm ghost" data-del>${L('Eliminar', 'Delete')}</button><span class="note">${c.submissions.filter((s) => s.callId === x.id).length} ${L('postulaciones', 'applications')}</span></div></div>`).join('')}`
  m.querySelector('[data-add]')!.addEventListener('click', () => (content.update((d) => d.calls.unshift({ id: uid('c'), title: L('Nueva convocatoria', 'New open call'), description: '', terms: '', deadline: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), open: false })), rr()))
  m.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
    const i = Number(el.dataset.i)
    el.querySelector('[data-save]')!.addEventListener('click', () => (content.update((d) => readForm(el, d.calls[i])), rr()))
    el.querySelector('[data-del]')!.addEventListener('click', () => confirm(L('¿Eliminar?', 'Delete?')) && (content.update((d) => d.calls.splice(i, 1)), rr()))
  })
}

export function forumView(m: HTMLElement, rr: R) {
  const ev = content.data.forum
  m.innerHTML = `<h1 class="serif">${L('Foro · Anfiteatro', 'Forum · Amphitheater')}</h1><p class="lead">${L('Programa conciertos, DJs, fiestas y charlas. El próximo evento visible aparece en la pantalla del anfiteatro; sus imágenes y videos decoran el escenario.', 'Schedule concerts, DJs, parties and talks. The next visible event shows on the amphitheater screen; its images and videos dress the stage.')}</p>
    <div class="row" style="margin-bottom:14px"><button class="btn primary sm" data-add>+ ${L('Programar evento', 'Schedule event')}</button></div>
    ${ev.map((x, i) => `<div class="sec glass" data-i="${i}"><div class="fgrid">${inp('title', L('Evento', 'Event'), x.title)}${inp('date', L('Fecha', 'Date'), x.date, 'date')}${inp('time', L('Hora', 'Time'), x.time, 'time')}
      <label>${L('Tipo', 'Kind')}<select data-k="kind">${['concierto', 'dj', 'fiesta', 'charla', 'performance'].map((k) => `<option ${k === x.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></label>${box('visible', L('Visible', 'Visible'), x.visible)}
      ${inp('description', L('Descripción', 'Description'), x.description, 'textarea', true)}${inp('en.title', 'Event (EN)', x.en?.title ?? '')}${inp('en.description', 'Description (EN)', x.en?.description ?? '', 'textarea', true)}</div>
      ${assetsEditor(x.assets)}<div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button><button class="btn sm ghost" data-del>${L('Eliminar', 'Delete')}</button></div></div>`).join('')}`
  m.querySelector('[data-add]')!.addEventListener('click', () => (content.update((d) => d.forum.unshift({ id: uid('fo'), title: L('Nuevo evento', 'New event'), date: new Date().toISOString().slice(0, 10), time: '21:00', kind: 'dj', description: '', assets: [], visible: false })), rr()))
  m.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
    const i = Number(el.dataset.i)
    const x = content.data.forum[i]
    wireAssets(el, x.assets, () => (content.update(() => {}), rr()))
    el.querySelector('[data-save]')!.addEventListener('click', () => (content.update((d) => readForm(el.querySelector('.fgrid')!, d.forum[i])), rr()))
    el.querySelector('[data-del]')!.addEventListener('click', () => confirm(L('¿Eliminar?', 'Delete?')) && (content.update((d) => d.forum.splice(i, 1)), rr()))
  })
}

export function meetingsView(m: HTMLElement, rr: R) {
  const base = location.origin + location.pathname
  m.innerHTML = `<h1 class="serif">${L('Sala de juntas', 'Meeting room')}</h1><p class="lead">${L('Recinto privado para hasta 8 personas con voz y chat. No tiene puerta pública: sólo se entra con el enlace. Si llenas la lista de invitados, sólo esos nombres pueden entrar.', 'Private chamber for up to 8 people with voice and chat. It has no public door: entry is by link only. If you fill the guest list, only those names can enter.')}</p>
    <div class="row" style="margin-bottom:14px"><button class="btn primary sm" data-add>+ ${L('Nueva sala', 'New room')}</button></div>
    ${content.data.meetings.map((x, i) => {
      const link = `${base}?meet=${encodeURIComponent(x.code)}#/museo`
      return `<div class="sec glass" data-i="${i}"><div class="fgrid">${inp('name', L('Nombre', 'Name'), x.name)}${inp('code', L('Código privado', 'Private code'), x.code)}${box('active', L('Activa', 'Active'), x.active)}
      ${inp('allowed', L('Invitados (nombres, uno por línea · vacío = cualquiera con el link)', 'Guests (names, one per line · empty = anyone with the link)'), x.allowed, 'textarea', true)}</div>
      <div class="row"><input readonly value="${esc(link)}" style="flex:1"><button class="btn sm" data-copy="${esc(link)}">${L('Copiar link', 'Copy link')}</button><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button><button class="btn sm ghost" data-del>${L('Eliminar', 'Delete')}</button></div></div>`
    }).join('')}`
  m.querySelector('[data-add]')!.addEventListener('click', () => (content.update((d) => d.meetings.push({ id: uid('m'), name: L('Nueva junta', 'New meeting'), code: 'jnt-' + Math.random().toString(36).slice(2, 10), allowed: '', active: true })), rr()))
  m.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy!).then(() => (b.textContent = '✓'))))
  m.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
    const i = Number(el.dataset.i)
    el.querySelector('[data-save]')!.addEventListener('click', () => (content.update((d) => readForm(el.querySelector('.fgrid')!, d.meetings[i])), rr()))
    el.querySelector('[data-del]')!.addEventListener('click', () => confirm(L('¿Eliminar?', 'Delete?')) && (content.update((d) => d.meetings.splice(i, 1)), rr()))
  })
}

export function aboutView(m: HTMLElement, rr: R) {
  const a = content.data.about
  m.innerHTML = `<h1 class="serif">About the museum</h1><p class="lead">${L('Texto del monolito "Sobre el museo" en el lobby.', 'Text of the "About the museum" monolith in the lobby.')}</p>
    <div class="sec glass"><div class="fgrid">${inp('title', L('Título', 'Title'), a.title, 'text', true)}${inp('body', L('Texto', 'Text'), a.body, 'textarea', true)}${inp('mission', L('Misión', 'Mission'), a.mission, 'textarea', true)}${inp('credits', L('Créditos', 'Credits'), a.credits, 'textarea', true)}
    ${inp('en.title', 'Title (EN)', a.en?.title ?? '', 'text', true)}${inp('en.body', 'Text (EN)', a.en?.body ?? '', 'textarea', true)}${inp('en.mission', 'Mission (EN)', a.en?.mission ?? '', 'textarea', true)}${inp('en.credits', 'Credits (EN)', a.en?.credits ?? '', 'textarea', true)}</div>
    <div class="row"><button class="btn primary sm" data-save>${L('Guardar', 'Save')}</button></div></div>`
  m.querySelector('[data-save]')!.addEventListener('click', () => (content.update((d) => readForm(m.querySelector('.fgrid')!, d.about)), rr()))
}

/** Revenue lives behind a second PIN (4441). */
export function revenueView(charts: () => string, table: (n: number) => string) {
  return (m: HTMLElement, rr: R) => {
    if (!sessionStorage.getItem('cm.revenuePin')) {
      m.innerHTML = `<h1 class="serif">${L('Ingresos', 'Revenue')}</h1><div class="sec glass" style="max-width:360px"><p class="note">${L('Sección protegida: introduce el PIN de ingresos.', 'Protected section: enter the revenue PIN.')}</p><div class="row"><input type="password" inputmode="numeric" maxlength="4" data-rpin style="flex:1"><button class="btn primary sm" data-ok>${L('Entrar', 'Enter')}</button></div><p class="note err" data-err></p></div>`
      const go = async () => {
        const pin = val(m, '[data-rpin]')
        const st = await fetch('./api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, kind: 'revenue' }) }).then((r) => r.status).catch(() => 0)
        if (st === 200 || (st !== 401 && pin === '4441')) (sessionStorage.setItem('cm.revenuePin', pin), rr())
        else (m.querySelector('[data-err]') as HTMLElement).textContent = L('PIN incorrecto', 'Wrong PIN')
      }
      m.querySelector('[data-ok]')!.addEventListener('click', go)
      m.querySelector('[data-rpin]')!.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && go())
      return
    }
    const today = payments.list.filter((p) => Date.now() - p.at < 864e5)
    m.innerHTML = `<h1 class="serif">${L('Ingresos', 'Revenue')}</h1>
      <div class="cards">${[[L('Total', 'Total'), money(payments.total())], [L('Últimas 24 h', 'Last 24 h'), money(today.reduce((s, p) => s + p.amount, 0))], [L('Pagos', 'Payments'), payments.list.length], [L('Ticket promedio', 'Average ticket'), money(payments.list.length ? payments.total() / payments.list.length : 0)]].map(([k, v]) => `<div class="stat glass"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      ${charts()}
      <div class="sec glass"><h3 class="serif">Stripe <span class="chip" data-stripe>…</span></h3><p class="note">${L('Para cobrar de verdad agrega <code>STRIPE_SECRET_KEY</code> (y opcional <code>STRIPE_WEBHOOK_SECRET</code>, webhook en <code>/api/webhook</code>) en las variables de entorno de Vercel. Sin la clave, el museo funciona en modo demo.', 'To take real payments add <code>STRIPE_SECRET_KEY</code> (and optionally <code>STRIPE_WEBHOOK_SECRET</code>, webhook at <code>/api/webhook</code>) to the Vercel environment variables. Without the key the museum runs in demo mode.')}</p><div data-stx></div></div>
      <div class="sec glass"><h3 class="serif">${L('Simulador demo', 'Demo simulator')}</h3><div class="row">${[20, 100, 500, 2000].map((a) => `<button class="btn sm" data-sim="${a}">${L('Simular', 'Simulate')} ${money(a)}</button>`).join('')}</div></div>
      <div class="sec glass"><h3 class="serif">${L('Historial', 'History')}</h3>${table(60)}<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-clear>${L('Borrar historial local', 'Clear local history')}</button><button class="btn sm ghost" data-lock>${L('Bloquear', 'Lock')}</button></div></div>`
    m.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach((b) => (b.onclick = () => (payments.ingest(payments.make(Number(b.dataset.sim), L('Donación demo', 'Demo donation'), 'donacion', 'Demo', 'sim')), rr())))
    m.querySelector('[data-clear]')!.addEventListener('click', () => confirm('?') && (payments.clear(), rr()))
    m.querySelector('[data-lock]')!.addEventListener('click', () => (sessionStorage.removeItem('cm.revenuePin'), rr()))
    stripePanel(m)
  }
}

async function stripePanel(m: HTMLElement) {
  const chip = m.querySelector('[data-stripe]') as HTMLElement
  const out = m.querySelector('[data-stx]') as HTMLElement
  const r = await fetch('./api/transactions', { headers: { 'x-revenue-pin': sessionStorage.getItem('cm.revenuePin') ?? '' }, cache: 'no-store' }).catch(() => null)
  if (!r || r.status === 503 || !r.ok) {
    chip.textContent = L('modo demo', 'demo mode')
    return
  }
  chip.textContent = L('conectado', 'connected')
  chip.classList.add('on')
  const items = ((await r.json()).items ?? []) as { amount: number; purpose: string; email: string; at: number }[]
  out.innerHTML = `<div class="cards"><div class="stat glass"><small>${L('Cobrado en Stripe', 'Collected on Stripe')}</small><b>${money(items.reduce((s, t) => s + t.amount, 0))}</b></div><div class="stat glass"><small>${L('Sesiones pagadas', 'Paid sessions')}</small><b>${items.length}</b></div></div>
    <table><tr><th>${L('Fecha', 'Date')}</th><th>${L('Concepto', 'Purpose')}</th><th>Email</th><th>${L('Monto', 'Amount')}</th></tr>${items.slice(0, 40).map((t) => `<tr><td>${timeAgo(t.at)}</td><td>${esc(t.purpose ?? '')}</td><td>${esc(t.email ?? '')}</td><td>${money(t.amount)}</td></tr>`).join('')}</table>`
}

export function statsView(m: HTMLElement) {
  const c = content.data
  const pieces = c.halls.reduce((s, x) => s + x.pieces.length, 0)
  const count = (k: string) => c.halls.filter((x) => x.kind === k).length
  const pend = c.submissions.filter((x) => (x.status ?? 'pendiente') === 'pendiente').length
  m.innerHTML = `<h1 class="serif">${L('Estadísticas', 'Statistics')}</h1><p class="lead">${L('Los cambios se publican para todos los visitantes', 'Changes are published to every visitor')} <span class="chip ${content.remote === 'on' ? 'on' : ''}">${content.remote === 'on' ? L('almacenamiento compartido', 'shared storage') : L('sólo este navegador', 'this browser only')}</span></p>
    <div class="cards">${[[L('Temporales', 'Temporary'), count('temporal')], [L('Salas 2D', '2D halls'), count('2d')], [L('Salas 3D', '3D halls'), count('3d')], [L('Portales de juego', 'Game portals'), count('games') + c.games.length], [L('Piezas', 'Pieces'), pieces], [L('Productos', 'Products'), c.products.length], [L('Programas videosala', 'Screenings'), c.films.length], [L('Eventos foro', 'Forum events'), c.forum.length], [L('Convocatorias abiertas', 'Open calls'), c.calls.filter((x) => x.open).length], [L('Postulaciones pendientes', 'Pending applications'), pend], [L('Plantas en el jardín', 'Garden plants'), payments.list.length]].map(([k, v]) => `<div class="stat glass"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`
}
