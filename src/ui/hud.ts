import QRCode from 'qrcode'
import type { Artwork, GameDoor, Product, RoomId } from '../content/types'
import { content } from '../content/store'
import { paintClone } from '../core/gen2d'
import { resolveMedia } from '../core/media'
import { Emitter, esc, h, isTouch, money, timeAgo, uid } from '../core/util'
import { payments, type PaymentEvent, type PaymentPurpose } from '../payments/bus'
import { getProvider } from '../payments/provider'

export const ROOM_ORDER: RoomId[] = ['lobby', 'videosala', 'escultura', 'pintura', 'tienda', 'jardin', 'temporales', 'videojuegos', 'futuro']

export class Hud {
  el: HTMLElement
  teleport = new Emitter<RoomId>()
  chatSend = new Emitter<string>()
  act = new Emitter<void>()
  modalOpen = false
  playerName = ''
  private loc: HTMLElement
  private ticker: HTMLElement
  private meter: HTMLElement
  private prompt: HTMLElement
  private toastEl: HTMLElement
  private online: HTMLElement
  private chatLog: HTMLElement
  private chatBox: HTMLElement
  private drawer: HTMLElement
  private current: RoomId = 'lobby'
  joy = { x: 0, y: 0 }

  constructor(private ui: HTMLElement) {
    this.el = h('div', { id: 'hud' })
    this.el.innerHTML = `
      <div class="tl"><a class="brand glass" href="#" data-home><span class="glyph star">✦</span><b>CYBERMUSEO</b></a><div class="loc glass">Estás en<b>Lobby</b></div></div>
      <div class="energy glass">NUBE<div class="meter"><i></i></div></div>
      <div class="tr"><div class="online glass off"><i></i><span>solo</span></div><button class="icon-btn glass" data-chat title="Chat">✎</button><button class="icon-btn glass" data-menu title="Menú">☰</button></div>
      <div class="ticker"></div>
      <div class="prompt glass hidden"><kbd>E</kbd><span></span></div>
      <div class="toast" style="opacity:0"><span class="kicker"></span><h2 class="serif"></h2></div>
      <div class="br"><button class="btn glass sm" data-shop>Tienda</button><button class="btn primary sm" data-donate>Apoyar ♡</button></div>
      <div class="chat glass hidden"><div class="log"></div><form><input maxlength="140" placeholder="Escribe a los demás visitantes…"><button class="btn sm">↵</button></form></div>
      ${isTouch() ? '' : '<div class="help glass"><kbd>WASD</kbd> caminar · <kbd>Shift</kbd> correr<br><kbd>arrastrar</kbd> cámara · <kbd>E</kbd> interactuar<br><kbd>M</kbd> mapa · <kbd>Enter</kbd> chat</div>'}`
    ui.append(this.el)
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T
    this.loc = q('.loc b')
    this.ticker = q('.ticker')
    this.meter = q('.energy .meter i')
    this.prompt = q('.prompt')
    this.toastEl = q('.toast')
    this.online = q('.online')
    this.chatLog = q('.chat .log')
    this.chatBox = q('.chat')
    const help = this.el.querySelector('.help') as HTMLElement | null
    if (help) setTimeout(() => (help.style.opacity = '0'), 14000)
    this.drawer = h('div', { class: 'drawer glass' })
    ui.append(this.drawer)
    q('[data-menu]').onclick = () => this.toggleDrawer()
    q('[data-home]').onclick = (e) => (e.preventDefault(), this.teleport.emit('lobby'))
    q('[data-chat]').onclick = () => this.toggleChat()
    q('[data-shop]').onclick = () => this.openShop()
    q('[data-donate]').onclick = () => this.openPay(100, 'Donación al museo', 'donacion')
    this.prompt.onclick = () => this.act.emit()
    const form = q<HTMLFormElement>('.chat form')
    form.onsubmit = (e) => {
      e.preventDefault()
      const i = form.querySelector('input')!
      const v = i.value.trim()
      if (v) this.chatSend.emit(v)
      i.value = ''
      i.blur()
    }
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.code === 'KeyE' && !this.modalOpen) this.act.emit()
      if (e.code === 'KeyM') this.toggleDrawer()
      if (e.code === 'Escape') this.closeModal()
      if (e.code === 'Enter' && !this.modalOpen) {
        this.toggleChat(true)
        ;(this.chatBox.querySelector('input') as HTMLInputElement).focus()
      }
    })
    if (isTouch()) this.touch()
    payments.received.on((p) => this.tick(p))
    this.renderDrawer()
  }

  setRoom(id: RoomId) {
    if (id === this.current) return
    this.current = id
    const r = content.data.rooms[id]
    const name = id === 'futuro' ? content.data.settings.futureName : r.name
    this.loc.textContent = name
    this.toast(r.subtitle, name)
    this.renderDrawer()
  }

  setOnline(n: number, on: boolean) {
    this.online.classList.toggle('off', !on)
    ;(this.online.querySelector('span') as HTMLElement).textContent = on ? `${n} en línea` : 'solo'
  }

  setEnergy(e: number) {
    this.meter.style.width = `${Math.min(100, e * 100)}%`
  }

  setPrompt(label: string | null) {
    this.prompt.classList.toggle('hidden', !label || this.modalOpen)
    if (label) (this.prompt.querySelector('span') as HTMLElement).textContent = label
    ;(this.prompt.querySelector('kbd') as HTMLElement).textContent = isTouch() ? 'toca' : 'E'
  }

  toast(kicker: string, title: string) {
    ;(this.toastEl.querySelector('.kicker') as HTMLElement).textContent = kicker
    ;(this.toastEl.querySelector('h2') as HTMLElement).textContent = title
    this.toastEl.style.opacity = '1'
    clearTimeout((this.toastEl as any)._t)
    ;(this.toastEl as any)._t = setTimeout(() => (this.toastEl.style.opacity = '0'), 2600)
  }

  tick(p: PaymentEvent) {
    const t = h('div', { class: 't glass' })
    t.innerHTML = `<span>✦ <b>${esc(p.payer)}</b> · ${esc(p.concept)}</span><b>${money(p.amount)}</b>`
    this.ticker.prepend(t)
    while (this.ticker.children.length > 4) this.ticker.lastElementChild?.remove()
    setTimeout(() => t.classList.add('fade'), 7000)
    setTimeout(() => t.remove(), 8600)
  }

  chat(name: string, text: string, sys = false) {
    const d = h('div', { class: sys ? 'sys' : '' })
    d.innerHTML = sys ? esc(text) : `<b>${esc(name)}</b> ${esc(text)}`
    this.chatLog.append(d)
    while (this.chatLog.children.length > 60) this.chatLog.firstElementChild?.remove()
    this.chatLog.scrollTop = this.chatLog.scrollHeight
  }

  toggleChat(force?: boolean) {
    this.chatBox.classList.toggle('hidden', force === undefined ? undefined : !force)
  }

  toggleDrawer(force?: boolean) {
    this.drawer.classList.toggle('open', force)
    if (this.drawer.classList.contains('open')) this.renderDrawer()
  }

  renderDrawer() {
    const c = content.data
    const ev = [...c.events].sort((a, b) => a.date.localeCompare(b.date))
    this.drawer.innerHTML = `<button class="icon-btn x" data-x>✕</button>
      <span class="kicker">Mapa del edificio</span><h3 class="serif">Salas</h3>
      <div class="navlist">${ROOM_ORDER.map((id) => {
        const r = c.rooms[id]
        const open = id === 'futuro' ? c.settings.futureOpen : r.open
        const name = id === 'futuro' ? c.settings.futureName : r.name
        return `<button data-room="${id}" class="${id === this.current ? 'on' : ''}" ${open || id === 'lobby' ? '' : 'disabled'}>${esc(name)}<span>${open ? esc(r.subtitle) : 'próximamente'}</span></button>`
      }).join('')}</div>
      <h3 class="serif">Eventos</h3>
      ${ev.map((e) => `<div class="ev"><b>${esc(e.title)}</b><small>${esc(e.date)} · ${esc(e.kind)}</small></div>`).join('')}
      <div class="row" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" data-call>Convocatoria</button><button class="btn sm" data-shop>Tienda</button><a class="btn sm ghost" href="#admin">SuperAdmin</a>
      </div>
      <p class="muted" style="font-size:11px;margin-top:16px">Total recaudado · ${money(payments.total())} · ${payments.list.length} pagos</p>`
    this.drawer.querySelector('[data-x]')!.addEventListener('click', () => this.toggleDrawer(false))
    this.drawer.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((b) => (b.onclick = () => {
      this.teleport.emit(b.dataset.room as RoomId)
      this.toggleDrawer(false)
    }))
    this.drawer.querySelector('[data-call]')!.addEventListener('click', () => (this.toggleDrawer(false), this.openCall()))
    this.drawer.querySelector('[data-shop]')!.addEventListener('click', () => (this.toggleDrawer(false), this.openShop()))
  }

  // ---------- modals ----------
  private wrap: HTMLElement | null = null
  private abort: AbortController | null = null
  modal(cls: string, html: string) {
    this.closeModal()
    this.modalOpen = true
    this.setPrompt(null)
    const wrap = h('div', { class: 'modal-wrap' })
    wrap.innerHTML = `<div class="modal glass ${cls}"><button class="icon-btn x" data-x>✕</button>${html}</div>`
    wrap.addEventListener('click', (e) => e.target === wrap && this.closeModal())
    wrap.querySelector('[data-x]')!.addEventListener('click', () => this.closeModal())
    this.ui.append(wrap)
    this.wrap = wrap
    return wrap.querySelector('.modal') as HTMLElement
  }
  closeModal() {
    this.abort?.abort()
    this.abort = null
    this.wrap?.remove()
    this.wrap = null
    this.modalOpen = false
  }

  async mediaEl(gen: string | undefined, seed: number | undefined, media: string | undefined, kind: string) {
    const url = media ? await resolveMedia(media) : null
    if (url && kind === 'video') return h('video', { src: url, controls: true, autoplay: true, loop: true, playsinline: true })
    if (url && kind === 'image') return h('img', { src: url, alt: '' })
    return paintClone(gen, seed ?? 1, 768)
  }

  async openArt(a: Artwork) {
    const list = content.data.artworks.filter((x) => x.room === a.room)
    const i = list.findIndex((x) => x.id === a.id)
    const m = this.modal('art', `<div class="media"></div><div>
      <span class="kicker">${esc(content.data.rooms[a.room].name)}</span>
      <h2 class="serif">${esc(a.title)}</h2>
      <div class="meta">${esc(a.author)} · ${esc(a.year)} · ${a.kind === 'generative' ? 'obra generativa en tiempo real' : esc(a.kind)}</div>
      <p class="desc">${esc(a.description)}</p>
      <div class="tags">${a.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      <div class="actions"><button class="btn primary sm" data-support>Apoyar al artista ♡</button><div class="pager"><button class="icon-btn" data-prev>‹</button><span>${i + 1} / ${list.length}</span><button class="icon-btn" data-next>›</button></div></div></div>`)
    const media = m.querySelector('.media')!
    media.append(await this.mediaEl(a.gen, a.seed, a.media, a.kind === 'model' ? 'generative' : a.kind))
    m.querySelector('[data-prev]')!.addEventListener('click', () => this.openArt(list[(i - 1 + list.length) % list.length]))
    m.querySelector('[data-next]')!.addEventListener('click', () => this.openArt(list[(i + 1) % list.length]))
    m.querySelector('[data-support]')!.addEventListener('click', () => this.openPay(50, `Apoyo · ${a.title}`, 'donacion'))
  }

  openShop(focus?: Product) {
    const c = content.data
    const m = this.modal('shop', `<span class="kicker">${esc(c.rooms.tienda.subtitle)}</span><h2 class="serif">${esc(c.rooms.tienda.name)}</h2>
      <p class="desc">Merch oficial: stickers, ropa, prints y objetos. Cada compra enciende la nube y planta una flor en el jardín.</p>
      <div class="products">${c.products.map((p) => `<div class="p glass ${focus?.id === p.id ? 'on' : ''}" data-id="${p.id}"><div class="thumb"></div><b>${esc(p.name)}</b><small>${esc(p.description)}</small><div class="price">${money(p.price)}</div><button class="btn sm primary" data-buy="${p.id}">Comprar</button></div>`).join('')}</div>`)
    c.products.forEach(async (p) => {
      const t = m.querySelector(`[data-id="${p.id}"] .thumb`)!
      t.append(await this.mediaEl(p.gen, p.seed, p.media, 'image'))
    })
    m.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => (b.onclick = () => {
      const p = c.products.find((x) => x.id === b.dataset.buy)!
      this.openPay(p.price, p.name, 'tienda', true)
    }))
    if (focus) setTimeout(() => m.querySelector(`[data-id="${focus.id}"]`)?.scrollIntoView({ block: 'center' }), 50)
  }

  openPay(amount: number, concept: string, purpose: PaymentPurpose, fixed = false) {
    const amounts = [20, 50, 100, 200, 500]
    const m = this.modal('pay', `<span class="kicker">${purpose === 'tienda' ? 'Compra' : purpose === 'jardin' ? 'Jardín digital' : 'Apoyo'}</span>
      <h2 class="serif">${esc(concept)}</h2>
      <p class="desc">Pago con CoDi / SPEI. Al confirmarse, la nube gaussiana entra en sobrecarga, la luz del museo cambia y crece una flor en el jardín para todos los visitantes.</p>
      ${fixed ? '' : `<div class="amounts">${amounts.map((a) => `<button class="btn sm ${a === amount ? 'on' : ''}" data-a="${a}">${money(a)}</button>`).join('')}</div>`}
      <div class="form"><label>Nombre que aparecerá en el museo<input data-payer maxlength="24" value="${esc(this.playerName)}"></label></div>
      <div class="actions"><button class="btn primary" data-go>Generar QR · <span data-amt>${money(amount)}</span></button></div>
      <div class="qr hidden"></div>`)
    let amt = amount
    m.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => (b.onclick = () => {
      amt = Number(b.dataset.a)
      m.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('on', x === b))
      m.querySelector('[data-amt]')!.textContent = money(amt)
    }))
    m.querySelector('[data-go]')!.addEventListener('click', async () => {
      const payer = (m.querySelector('[data-payer]') as HTMLInputElement).value.trim() || this.playerName || 'Anónimo'
      const qr = m.querySelector('.qr') as HTMLElement
      qr.classList.remove('hidden')
      qr.innerHTML = '<p class="muted">Generando cobro…</p>'
      try {
        const provider = getProvider()
        const co = await provider.createCheckout(amt, concept, purpose, payer)
        qr.innerHTML = ''
        if (co.qrString) {
          const cv = document.createElement('canvas')
          await QRCode.toCanvas(cv, co.qrString, { width: 220, margin: 1, color: { dark: '#0b0a12', light: '#ece8ff' } })
          qr.append(cv)
        }
        if (co.url) qr.append(h('a', { class: 'btn sm', href: co.url, target: '_blank', rel: 'noopener' }, 'Abrir link de pago'))
        qr.append(h('p', { class: 'muted' }, co.simulated ? `Modo demo (${provider.name}) · el pago real con pey se conectará después.` : 'Escanea con la app de tu banco (CoDi). Esperando confirmación…'))
        if (co.simulate) {
          const b = h('button', { class: 'btn primary sm' }, 'Simular pago recibido ✦')
          b.onclick = () => co.simulate!()
          qr.append(b)
        }
        this.abort = new AbortController()
        const ev = await co.wait(this.abort.signal)
        if (ev) {
          payments.ingest(ev)
          this.modal('pay', `<span class="kicker">Pago confirmado · ${money(ev.amount)}</span><h2 class="serif">Gracias, ${esc(ev.payer)} ✦</h2><p class="desc">La nube del lobby acaba de encenderse y una nueva flor crece en el Jardín Digital.</p><div class="actions"><button class="btn primary sm" data-garden>Ir al jardín</button></div>`)
            .querySelector('[data-garden]')!.addEventListener('click', () => (this.closeModal(), this.teleport.emit('jardin')))
        }
      } catch (err) {
        qr.innerHTML = `<p class="muted">No se pudo generar el cobro: ${esc(String((err as Error).message ?? err))}</p>`
      }
    })
  }

  openCall() {
    const t = content.data.temp
    const m = this.modal('call', `<span class="kicker">Convocatoria ${t.callOpen ? 'abierta' : 'cerrada'} · cierre ${esc(t.callDeadline)}</span>
      <h2 class="serif">${esc(t.callTitle)}</h2><p class="desc">${esc(t.statement)}</p>
      ${t.callOpen ? `<form class="form"><label>Nombre<input name="name" required maxlength="60"></label><label>Correo<input name="email" type="email" required></label>
      <label>Título de la propuesta<input name="title" required maxlength="80"></label><label>Link al portafolio u obra<input name="link" type="url" placeholder="https://"></label>
      <label>Mensaje<textarea name="message" rows="3" maxlength="800"></textarea></label><div class="actions"><button class="btn primary">Enviar propuesta</button></div></form>` : '<p class="muted">La próxima convocatoria se anunciará en la agenda de eventos.</p>'}`)
    const f = m.querySelector('form')
    if (f) f.onsubmit = (e) => {
      e.preventDefault()
      const d = new FormData(f)
      content.update((c) => c.submissions.unshift({ id: uid('sub'), name: String(d.get('name')), email: String(d.get('email')), title: String(d.get('title')), link: String(d.get('link') ?? ''), message: String(d.get('message') ?? ''), at: Date.now() }))
      this.modal('call', `<span class="kicker">Recibido</span><h2 class="serif">Gracias por tu propuesta</h2><p class="desc">El equipo curatorial la revisará desde el panel SuperAdmin.</p>`)
    }
  }

  openEvents() {
    const ev = [...content.data.events].sort((a, b) => a.date.localeCompare(b.date))
    this.modal('events', `<span class="kicker">Agenda</span><h2 class="serif">Eventos del museo</h2>
      ${ev.map((e) => `<div class="ev glass" style="padding:12px 14px;border-radius:14px;margin:8px 0"><span class="kicker">${esc(e.date)} · ${esc(e.kind)}</span><b class="serif" style="display:block;font-size:18px;font-weight:400">${esc(e.title)}</b><small class="muted">${esc(e.description)}</small></div>`).join('')}
      <p class="muted" style="font-size:11px">Último pago: ${payments.list[0] ? timeAgo(payments.list[0].at) : '—'}</p>`)
  }

  openGame(g: GameDoor, start: (g: GameDoor) => void) {
    if (!g.open) {
      this.modal('game', `<span class="kicker">Próximamente</span><h2 class="serif">${esc(g.title)}</h2><p class="desc">${esc(g.description)}</p>`)
      return
    }
    if (g.kind === 'url' && g.target) {
      this.closeModal()
      this.modalOpen = true
      const w = h('div', { class: 'iframe-wrap' })
      w.innerHTML = `<iframe src="${esc(g.target)}" allow="fullscreen; gamepad; autoplay" allowfullscreen></iframe><button class="icon-btn glass x">✕</button>`
      w.querySelector('.x')!.addEventListener('click', () => (w.remove(), (this.modalOpen = false)))
      this.ui.append(w)
      return
    }
    const m = this.modal('game', `<span class="kicker">Pasillo de videojuegos</span><h2 class="serif">${esc(g.title)}</h2><p class="desc">${esc(g.description)}</p><div class="actions"><button class="btn primary" data-play>Cruzar el portal ✦</button></div>`)
    m.querySelector('[data-play]')!.addEventListener('click', () => (this.closeModal(), start(g)))
  }

  gamebar(html: string | null) {
    let b = this.el.querySelector('.gamebar') as HTMLElement | null
    if (!html) return b?.remove()
    if (!b) {
      b = h('div', { class: 'gamebar glass' })
      this.el.append(b)
    }
    b.innerHTML = html
  }

  private touch() {
    const t = h('div', { id: 'touch' })
    t.innerHTML = `<div class="stick glass"><i></i></div><div class="act"><button class="glass" data-act>✦</button></div>`
    this.ui.append(t)
    const stick = t.querySelector('.stick') as HTMLElement
    const knob = stick.querySelector('i') as HTMLElement
    let id: number | null = null
    const set = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect()
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
      const l = Math.hypot(x, y)
      if (l > 1) ((x /= l), (y /= l))
      this.joy.x = x
      this.joy.y = -y
      knob.style.transform = `translate(${x * 35}px, ${y * 35}px)`
    }
    stick.addEventListener('pointerdown', (e) => ((id = e.pointerId), stick.setPointerCapture(e.pointerId), set(e)))
    stick.addEventListener('pointermove', (e) => e.pointerId === id && set(e))
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = null
      this.joy.x = this.joy.y = 0
      knob.style.transform = ''
    }
    stick.addEventListener('pointerup', end)
    stick.addEventListener('pointercancel', end)
    ;(t.querySelector('[data-act]') as HTMLElement).onclick = () => this.act.emit()
  }
}
