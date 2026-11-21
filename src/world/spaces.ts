import * as THREE from 'three'
import { L, tx } from '../core/i18n'
import type { Content, Hall, HallKind, Piece, RoomId } from '../content/types'
import { M } from './materials'
import { archOutline, column } from './gothic'
import { sculpture, textureFor } from './art'
import { LOBBY_R, type Interactable, type Wing } from './building'
import type { Nav } from './nav'
import { fit, loadGLB, tame } from './assets'

export interface SpaceHooks {
  openPiece(h: Hall, p: Piece): void
  openHall(h: Hall): void
  openUrl(url: string, title: string): void
  goto(target: { x: number; z: number; yaw: number }, title: string, kicker: string): void
  openForum(): void
  openCalls(): void
  openAbout(): void
}

export const HALL_WING: Record<HallKind, RoomId> = { temporal: 'temporales', '2d': 'pintura', '3d': 'escultura', games: 'videojuegos' }
const GEN_3D = ['liquid', 'knot', 'lattice', 'bust', 'ribbon', 'angel']
const BASE_X = 520

/** Canvas text panel with word-wrapping and auto-shrink so nothing is clipped. */
export function textPanel(title: string, body: string, w = 3, h = 1.6, color = '#c9b3ff', kicker = '') {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = Math.round(w * S)
  cv.height = Math.round(h * S)
  const g = cv.getContext('2d')!
  g.fillStyle = 'rgba(10,8,20,0.82)'
  g.fillRect(0, 0, cv.width, cv.height)
  g.strokeStyle = color
  g.lineWidth = 4
  g.strokeRect(8, 8, cv.width - 16, cv.height - 16)
  const pad = 36
  const maxW = cv.width - pad * 2
  const wrap = (txt: string, font: string) => {
    g.font = font
    const lines: string[] = []
    for (const para of txt.split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/)) {
        const t = line ? line + ' ' + word : word
        if (g.measureText(t).width > maxW && line) (lines.push(line), (line = word))
        else line = t
      }
      lines.push(line)
    }
    return lines
  }
  let ts = Math.min(64, cv.height * 0.18)
  let bs = 30
  for (let k = 0; k < 12; k++) {
    const tl = wrap(title, `${ts}px "Playfair Display", serif`).length
    const bl = body ? wrap(body, `${bs}px "Roboto Mono", monospace`).length : 0
    if (pad * 2 + (kicker ? 34 : 0) + tl * ts * 1.15 + bl * bs * 1.45 <= cv.height) break
    ts *= 0.88
    bs *= 0.88
  }
  let y = pad
  g.textBaseline = 'top'
  if (kicker) {
    g.fillStyle = color
    g.font = '24px "Roboto Mono", monospace'
    g.fillText(kicker.toUpperCase(), pad, y)
    y += 34
  }
  g.fillStyle = '#f2ecff'
  for (const l of wrap(title, `${ts}px "Playfair Display", serif`)) (g.fillText(l, pad, y), (y += ts * 1.15))
  g.fillStyle = '#bdb2dc'
  if (body) for (const l of wrap(body, `${bs}px "Roboto Mono", monospace`)) (g.fillText(l, pad, y), (y += bs * 1.45))
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }))
}

const portalMats = new Map<string, THREE.ShaderMaterial>()
const portalTime = { value: 0 }
export function portalMat(color: string) {
  let m = portalMats.get(color)
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uTime: portalTime, uC: { value: new THREE.Color(color) } },
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uC;
        void main(){ vec2 p=vUv*2.0-1.0; p.y*=0.6; float r=length(p); float a=atan(p.y,p.x);
          float s=sin(a*5.0+r*14.0-uTime*2.2)*0.5+0.5; float core=smoothstep(1.0,0.0,r);
          vec3 col=mix(vec3(0.02,0.0,0.06),uC,s*core)+uC*pow(core,3.0)*0.8;
          gl_FragColor=vec4(col,0.92*smoothstep(1.05,0.85,r)+0.08); }`,
    })
    portalMats.set(color, m)
  }
  return m
}

/** A gothic arch with a swirling portal surface. Origin at floor, facing +z. */
export function portalDoor(color: string, w = 2.2, h = 3.6) {
  const g = new THREE.Group()
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, h), portalMat(color))
  surf.position.y = h / 2
  g.add(surf)
  const arch = archOutline(w + 0.3, h + 0.5, 0.09)
  g.add(arch)
  for (const s of [-1, 1]) {
    const c = column(h + 0.4, 0.14)
    c.position.x = s * (w / 2 + 0.25)
    g.add(c)
  }
  const light = new THREE.PointLight(color, 6, 6, 1.6)
  light.position.set(0, h * 0.6, 0.8)
  g.add(light)
  return g
}

function pieceVisual(hall: Hall, p: Piece) {
  const a = p.assets.find((x) => x.kind !== 'link' && x.kind !== 'audio')
  if (a?.kind === 'model' && /\.(glb|gltf)($|\?)/i.test(a.url)) {
    const g = new THREE.Group()
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 1, 8), M.obsidian)
    ped.position.y = 0.5
    g.add(ped)
    loadGLB(a.url)
      .then((gl) => {
        const o = gl.scene
        tame(o)
        fit(o, 2)
        o.position.y += 1
        g.add(o)
        if (gl.animations.length) {
          const mixer = new THREE.AnimationMixer(o)
          gl.animations.forEach((c) => mixer.clipAction(c).play())
          g.userData.mixer = mixer
        }
      })
      .catch(() => {})
    return { obj: g, onWall: false }
  }
  if (!a && hall.kind === '3d' && p.gen && GEN_3D.includes(p.gen)) {
    const sc = sculpture({ id: p.id, room: 'escultura', title: p.title, author: p.author, year: p.year, description: p.lore, tags: [], kind: 'generative', gen: p.gen, seed: p.seed })
    sc.group.userData.tick = sc.tick
    return { obj: sc.group, onWall: false }
  }
  const kind = a?.kind === 'gif' ? 'image' : a?.kind
  const mat = textureFor(p.gen ?? 'nebula', p.seed ?? 1, a?.url, kind)
  const frame = new THREE.Group()
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), mat)
  pic.position.set(0, 2.2, 0.06)
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.1), new THREE.MeshStandardMaterial({ color: '#8a6a2c', metalness: 0.9, roughness: 0.4 }))
  back.position.y = 2.2
  frame.add(back, pic)
  return { obj: frame, onWall: true }
}

export function buildSpaces(root: THREE.Group, nav: Nav, c: Content, wings: Wing[], add: (i: Interactable) => void, hooks: SpaceHooks) {
  const today = new Date().toISOString().slice(0, 10)
  const live = (h: Hall) => h.visible && (!h.start || h.start <= today || h.kind === 'games') && (!h.end || h.end >= today)
  const halls = c.halls.filter(live)
  const entries = new Map<string, { x: number; z: number; yaw: number }>()
  const mixers: THREE.AnimationMixer[] = []
  const swirl: THREE.Object3D[] = []
  const ticks: ((t: number) => void)[] = []
  const back = (kind: HallKind, i: number) => {
    const w = wings.find((x) => x.room === HALL_WING[kind])!
    const p = w.world(i % 2 ? 1.2 : -1.2, -LOBBY_R - 3 - Math.floor(i / 2) * 4)
    return { x: p.x, z: p.z, yaw: (w.k * Math.PI) / 4 }
  }

  // --- portal doors in the wing corridors ---
  const perKind: Record<string, number> = {}
  for (const hall of halls) {
    const w = wings.find((x) => x.room === HALL_WING[hall.kind])
    if (!w || !w.open) continue
    const i = (perKind[hall.kind] = (perKind[hall.kind] ?? -1) + 1)
    if (i > 3) continue
    const side = i % 2 ? 1 : -1
    const lz = -LOBBY_R - 3 - Math.floor(i / 2) * 4
    const y = w.floorY * Math.min(1, Math.max(0, (-lz - LOBBY_R) / 10))
    const door = portalDoor(hall.color, 1.9, 3.2)
    door.position.set(side * 2.92, y, lz)
    door.rotation.y = -side * Math.PI / 2
    w.group.add(door)
    const sign = textPanel(tx(hall, 'name'), tx(hall, 'theme'), 2.1, 0.62, hall.color)
    sign.position.set(0, 4.15, 0.05)
    door.add(sign)
    swirl.push(door)
    const ip = w.world(side * 1.6, lz, y)
    const label = hall.external ? `${L('Abrir', 'Open')} · ${tx(hall, 'name')} ↗` : `${L('Entrar', 'Enter')} · ${tx(hall, 'name')}`
    add({ id: 'door-' + hall.id, pos: ip, r: 1.6, label, room: w.room, action: () => (hall.external ? hooks.openUrl(hall.external, tx(hall, 'name')) : hooks.goto(entries.get(hall.id)!, tx(hall, 'name'), tx(hall, 'theme'))) })
  }

  // --- the halls themselves, built off the main island ---
  halls.filter((h) => !h.external).forEach((hall, n) => {
    const pieces = hall.pieces.filter((p) => p.visible)
    const W = 14
    const Lh = Math.max(18, 8 + Math.ceil(pieces.length / 2) * 5)
    const cx = BASE_X + n * 40
    const cz = 0
    const g = new THREE.Group()
    g.position.set(cx, 0, cz)
    root.add(g)
    nav.rect('salas', cx, cz, 0, W / 2, Lh / 2, 0, 0, hall.id)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Lh), new THREE.MeshStandardMaterial({ color: '#1a1626', roughness: 0.35, metalness: 0.4 }))
    floor.rotation.x = -Math.PI / 2
    g.add(floor)
    const H = 7
    const tint = new THREE.MeshStandardMaterial({ color: '#15111f', roughness: 0.75, metalness: 0.1 })
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, H, Lh), tint)
      wall.position.set(s * (W / 2 + 0.2), H / 2, 0)
      const endw = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, H, 0.4), tint)
      endw.position.set(0, H / 2, s * (Lh / 2 + 0.2))
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, Lh), new THREE.MeshBasicMaterial({ color: hall.color, toneMapped: false }))
      strip.position.set(s * (W / 2 - 0.05), H - 0.2, 0)
      g.add(wall, endw, strip)
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, Lh), new THREE.MeshStandardMaterial({ color: '#0b0912', roughness: 1 }))
    ceil.rotation.x = Math.PI / 2
    ceil.position.y = H
    g.add(ceil)
    const lamp = new THREE.PointLight(hall.color, 14, 0, 1.6)
    lamp.position.set(0, H - 1, 0)
    g.add(lamp, new THREE.PointLight('#ffffff', 6, 0, 1.8).translateY(H - 1).translateZ(-Lh / 4))
    const intro = textPanel(tx(hall, 'name'), tx(hall, 'curatorial'), 5.2, 2.6, hall.color, tx(hall, 'theme'))
    intro.position.set(0, 3, -Lh / 2 + 0.02)
    g.add(intro)
    add({ id: 'hall-' + hall.id, pos: new THREE.Vector3(cx, 0, cz - Lh / 2 + 2.2), r: 2.2, label: L('Texto curatorial', 'Curatorial text'), room: 'salas', action: () => hooks.openHall(hall) })
    pieces.forEach((p, i) => {
      const side = i % 2 ? 1 : -1
      const lz = Lh / 2 - 6 - Math.floor(i / 2) * 5
      const { obj, onWall } = pieceVisual(hall, p)
      if (obj.userData.tick) ticks.push(obj.userData.tick)
      const later = () => obj.userData.mixer && mixers.push(obj.userData.mixer)
      setTimeout(later, 4000)
      const lx = onWall ? side * (W / 2 - 0.05) : side * (W / 2 - 2.4)
      obj.position.set(lx, 0, lz)
      obj.rotation.y = onWall ? -side * Math.PI / 2 : 0
      g.add(obj)
      if (!onWall) nav.obstacle(cx + lx, cz + lz, 1)
      const plaque = textPanel(tx(p, 'title'), `${p.author}${p.year ? ' · ' + p.year : ''}`, 1.5, 0.5, hall.color)
      if (onWall) plaque.position.set(0, 0.7, 0.08)
      else plaque.position.set(0, 1.25, 1.0)
      obj.add(plaque)
      add({ id: 'pc-' + p.id, pos: new THREE.Vector3(cx + side * (W / 2 - 3.2), 0, cz + lz), r: 2, label: `${L('Ver', 'View')} · ${tx(p, 'title')}`, room: 'salas', action: () => hooks.openPiece(hall, p) })
    })
    const exit = portalDoor('#b89cff', 2, 3.4)
    exit.position.set(0, 0, Lh / 2 - 0.1)
    exit.rotation.y = Math.PI
    g.add(exit)
    const k = halls.filter((x) => x.kind === hall.kind).indexOf(hall)
    add({ id: 'exit-' + hall.id, pos: new THREE.Vector3(cx, 0, cz + Lh / 2 - 1.4), r: 1.8, label: L('Salir de la sala', 'Leave the hall'), room: 'salas', action: () => hooks.goto(back(hall.kind, k), tx(c.rooms[HALL_WING[hall.kind]], 'name'), L('Regresando a', 'Back to')) })
    entries.set(hall.id, { x: cx, z: cz + Lh / 2 - 2.6, yaw: 0 })
  })

  return {
    entries,
    hallName: (id?: string) => {
      const h = c.halls.find((x) => x.id === id)
      return h ? tx(h, 'name') : null
    },
    tick(dt: number, t: number) {
      portalTime.value = t
      for (const m of mixers) m.update(dt)
      for (const f of ticks) f(t)
    },
  }
}
