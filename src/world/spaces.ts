import * as THREE from 'three'
import { L, tx } from '../core/i18n'
import type { Content, Hall, HallKind, Piece, RoomId } from '../content/types'
import { M } from './materials'
import { archivolt, column, nave as buildNave } from './gothic'
import type { NaveBay } from './gothic'
import { sculpture, textureFor } from './art'
import { LOBBY_R, type Interactable, type Wing } from './building'
import type { Nav } from './nav'
import { fit, loadGLB, tame } from './assets'
import { P } from './pbr'

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
  surf.position.set(0, h / 2, 0.035)
  g.add(surf)
  const arch = archivolt(w + 0.3, h + 0.5)
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
  const returns = new Map<string, { x: number; z: number; yaw: number }>()
  const hallGroups = new Map<string, THREE.Group>()
  const mixers: THREE.AnimationMixer[] = []
  const ticks: ((t: number) => void)[] = []

  const slots = new Map<RoomId, NaveBay[]>()
  const fallbackSlots = new Map<RoomId, NaveBay[]>()
  for (const w of wings) {
    slots.set(w.room, [...w.bays].sort((a, b) => b.z - a.z || a.side - b.side))
    const sideCount: Record<number, number> = { [-1]: 0, [1]: 0 }
    fallbackSlots.set(
      w.room,
      [...w.corridorBays]
        .sort((a, b) => b.z - a.z || a.side - b.side)
        .filter((bay) => {
          if (sideCount[bay.side] >= 2) return false
          sideCount[bay.side]++
          return true
        }),
    )
  }
  const wingSlotIndex = new Map<RoomId, number>()
  const fallbackIndex = new Map<RoomId, number>()

  for (const hall of halls) {
    const w = wings.find((x) => x.room === HALL_WING[hall.kind])
    if (!w || !w.open) continue
    const index = wingSlotIndex.get(w.room) ?? 0
    wingSlotIndex.set(w.room, index + 1)
    let bay = slots.get(w.room)?.[index]
    let inNarthex = false
    if (!bay) {
      const fallback = fallbackIndex.get(w.room) ?? 0
      fallbackIndex.set(w.room, fallback + 1)
      bay = fallbackSlots.get(w.room)?.[fallback]
      inNarthex = true
    }
    if (!bay) continue

    bay.chapel = true
    bay.niche.visible = false
    bay.chapelGroup.visible = true
    const portal = portalDoor(hall.color, 2.35, 4.2)
    portal.position.set(0, 0, -2.72)
    bay.chapelGroup.add(portal)
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.94, 0.14), M.obsidian)
    plaque.position.set(0, 6.02, 0.08)
    const plaqueTop = new THREE.Mesh(new THREE.BoxGeometry(3.28, 0.035, 0.045), M.gold)
    plaqueTop.position.set(0, 6.48, 0.17)
    const plaqueBottom = plaqueTop.clone()
    plaqueBottom.position.y = 5.56
    const plaqueText = textPanel(tx(hall, 'name'), tx(hall, 'theme').slice(0, 40), 2.92, 0.72, hall.color)
    plaqueText.position.set(0, 6.02, 0.17)
    const underArch = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, 0.025, 0.025),
      new THREE.MeshBasicMaterial({ color: hall.color, toneMapped: false, transparent: true, opacity: 0.7 }),
    )
    underArch.position.set(0, 0.11, 0.14)
    const portalLight = new THREE.PointLight(hall.color, 4, 9, 1.7)
    portalLight.position.set(0, 4.2, 0.35)
    bay.chapelGroup.add(plaque, plaqueTop, plaqueBottom, plaqueText, underArch, portalLight)

    const floorY = inNarthex ? w.floorY * Math.min(1, Math.max(0, (-bay.z - LOBBY_R) / 10)) : w.floorY
    const triggerX = bay.anchor.x - bay.side * 1.2
    const ip = w.world(triggerX, bay.z, floorY)
    const returnTarget = w.world(0, bay.z, floorY)
    const returnPoint = nav.freePoint(returnTarget.x, returnTarget.z) ?? returnTarget
    returns.set(hall.id, { x: returnPoint.x, z: returnPoint.z, yaw: (w.k * Math.PI) / 4 })
    const label = hall.external ? `${L('Abrir', 'Open')} · ${tx(hall, 'name')} ↗` : `${L('Entrar', 'Enter')} · ${tx(hall, 'name')}`
    add({
      id: 'chapel-' + hall.id,
      pos: ip,
      r: 1.8,
      label,
      room: w.room,
      action: () => {
        if (hall.external) hooks.openUrl(hall.external, tx(hall, 'name'))
        else {
          const target = entries.get(hall.id)
          if (target) hooks.goto(target, tx(hall, 'name'), tx(hall, 'theme'))
        }
      },
    })
  }

  halls.filter((hall) => !hall.external).forEach((hall, n) => {
    const pieces = hall.pieces.filter((p) => p.visible)
    const W = 12
    const H = 11
    const Lh = Math.max(20, 8 + Math.ceil(pieces.length / 2) * 5.5)
    const cx = BASE_X + n * 40
    const cz = 0
    const g = new THREE.Group()
    g.name = `hall-${hall.id}`
    g.position.set(cx, 0, cz + Lh / 2)
    root.add(g)
    hallGroups.set(hall.id, g)
    nav.rect('salas', cx, cz, 0, W / 2, Lh / 2, 0, 0, hall.id)
    const built = buildNave({ W, H, L: Lh, bay: 5.5, floorAlbedo: 1.03 })
    g.add(built.group)
    g.add(new THREE.HemisphereLight('#f3e9ff', '#4c405a', 1))
    for (const [y, z] of [[H - 1.2, -Lh / 3], [4.8, -Lh * 0.72]]) {
      const lamp = new THREE.PointLight(hall.color, 24, 28, 1.6)
      lamp.position.set(0, y, z)
      g.add(lamp)
    }
    const frameGold = M.gold.clone()
    frameGold.emissive.set('#8a681f')
    frameGold.emissiveIntensity = 0.32
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.3, 3.1, 0.18), M.obsidian)
    frame.position.set(0, 4.25, -Lh + 0.55)
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(6.42, 0.06, 0.06), frameGold)
    frameTop.position.set(0, 5.82, -Lh + 0.68)
    const frameBottom = frameTop.clone()
    frameBottom.position.y = 2.68
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.2, 0.06), frameGold)
    frameLeft.position.set(-3.18, 4.25, -Lh + 0.68)
    const frameRight = frameLeft.clone()
    frameRight.position.x = 3.18
    const intro = textPanel(tx(hall, 'name'), tx(hall, 'curatorial').slice(0, 180), 5.6, 2.45, hall.color, tx(hall, 'theme'))
    intro.position.set(0, 3.02, -Lh + 0.68)
    g.add(frame, frameTop, frameBottom, frameLeft, frameRight, intro)
    add({
      id: 'hall-' + hall.id,
      pos: new THREE.Vector3(cx, 0, cz - Lh / 2 + 2.2),
      r: 2.2,
      label: L('Texto curatorial', 'Curatorial text'),
      room: 'salas',
      action: () => hooks.openHall(hall),
    })

    if (hall.kind === 'temporal') {
      for (const side of [-1, 1]) {
        for (let i = 0; i < Math.ceil(Lh / 7); i++) {
          const z = -2.5 - i * 7
          const banner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.1, 1.35), P.velvet)
          banner.position.set(side * (W / 2 - 0.45), 7.7, z)
          const hem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 1.45), M.gold)
          hem.position.set(side * (W / 2 - 0.45), 6.12, z)
          g.add(banner, hem)
        }
      }
    } else if (hall.kind === '2d') {
      const wainscot = new THREE.MeshStandardMaterial({ color: '#211a25', roughness: 0.72, metalness: 0.15 })
      for (const side of [-1, 1]) {
        const paneling = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, Lh - 1), wainscot)
        paneling.position.set(side * (W / 2 - 0.34), 0.78, -Lh / 2)
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, Lh - 1), M.gold)
        rail.position.set(side * (W / 2 - 0.34), 1.56, -Lh / 2)
        g.add(paneling, rail)
      }
    }

    pieces.forEach((p, i) => {
      const side: -1 | 1 = i % 2 ? 1 : -1
      const lz = -6 - Math.floor(i / 2) * 5.5
      const { obj, onWall } = pieceVisual(hall, p)
      if (obj.userData.tick) ticks.push(obj.userData.tick)
      const later = () => obj.userData.mixer && mixers.push(obj.userData.mixer)
      setTimeout(later, 4000)
      const lx = onWall ? side * (W / 2 - 0.1) : side * (W / 2 - (hall.kind === '3d' ? 1.4 : 2.4))
      obj.position.set(lx, 0, lz)
      obj.rotation.y = onWall ? -side * Math.PI / 2 : 0
      g.add(obj)
      if (!onWall) nav.obstacle(cx + lx, cz + Lh / 2 + lz, 1)
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(2.2, 40),
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(hall.color) } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
          vertexShader: `varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `varying vec2 vUv; uniform vec3 uColor; void main(){ float a=pow(max(0.0,1.0-dot(vUv,vUv)),2.4)*0.12; gl_FragColor=vec4(uColor*a,a); }`,
        }),
      )
      pool.rotation.x = -Math.PI / 2
      pool.position.set(lx, 0.035, lz)
      g.add(pool)
      const plaque = textPanel(tx(p, 'title'), `${p.author}${p.year ? ' · ' + p.year : ''}`, 1.5, 0.5, hall.color)
      if (onWall) plaque.position.set(0, 0.7, 0.08)
      else plaque.position.set(0, 1.25, 1.0)
      obj.add(plaque)
      if (!onWall && hall.kind === '3d') {
        const shaft = new THREE.Mesh(
          new THREE.ConeGeometry(1.6, 7, 16, 1, true),
          new THREE.MeshBasicMaterial({ color: '#c5d9ff', transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        )
        shaft.position.set(lx, 7.4, lz)
        g.add(shaft)
      }
      add({
        id: 'pc-' + p.id,
        pos: new THREE.Vector3(cx + side * (W / 2 - 3.2), 0, cz + Lh / 2 + lz),
        r: 2,
        label: `${L('Ver', 'View')} · ${tx(p, 'title')}`,
        room: 'salas',
        action: () => hooks.openPiece(hall, p),
      })
    })
    if (hall.kind === 'games') {
      const used = new Set(pieces.map((_, i) => Math.floor(i / 2)))
      built.bays.forEach((bay, i) => {
        if (used.has(i)) return
        const surface = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.6), portalMat(hall.color))
        surface.position.set(bay.side * (W / 2 - 0.28), 2.7, bay.z)
        surface.rotation.y = -bay.side * Math.PI / 2
        g.add(surface)
      })
    }
    const exit = portalDoor('#b89cff', 2, 3.4)
    exit.position.set(0, 0, 0.16)
    exit.rotation.y = Math.PI
    g.add(exit)
    add({
      id: 'exit-' + hall.id,
      pos: new THREE.Vector3(cx, 0, cz + Lh / 2 - 1.4),
      r: 1.8,
      label: L('Salir de la sala', 'Leave the hall'),
      room: 'salas',
      action: () => {
        const target = returns.get(hall.id)
        if (target) hooks.goto(target, tx(c.rooms[HALL_WING[hall.kind]], 'name'), L('Regresando a', 'Back to'))
      },
    })
    entries.set(hall.id, { x: cx, z: cz + Lh / 2 - 2.6, yaw: 0 })
  })

  return {
    entries,
    groups: hallGroups,
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
