import * as THREE from 'three'
import type { Content, RoomId } from '../content/types'
import { paint } from '../core/gen2d'
import { Nav } from './nav'
import { M, floorMaterial, label } from './materials'
import { archOutline, archPath, candelabra, chandelier, column, spire, vault, wall, windowFill, type Opening } from './gothic'

export const LOBBY_R = 20
export const LOBBY_H = 14
const SIDES = 16
const CORRIDOR_END = 30

export interface Interactable {
  id: string
  pos: THREE.Vector3
  r: number
  label: string
  room: RoomId
  action: () => void
}

export interface Wing {
  room: RoomId
  k: number
  ang: number
  W: number
  L: number
  floorY: number
  open: boolean
  group: THREE.Group
  world(lx: number, lz: number, y?: number): THREE.Vector3
  rect(lcx: number, lcz: number, hw: number, hl: number, y0?: number, y1?: number): void
  obstacle(lx: number, lz: number, r: number): void
  circle(lcx: number, lcz: number, r: number): void
}

export const WING_DEFS: { room: RoomId; k: number; W: number; L: number; rise?: number }[] = [
  { room: 'videosala', k: 0, W: 18, L: 22 },
  { room: 'escultura', k: 1, W: 18, L: 20, rise: 2.4 },
  { room: 'pintura', k: 2, W: 14, L: 26 },
  { room: 'tienda', k: 3, W: 16, L: 18 },
  { room: 'jardin', k: 4, W: 44, L: 44 },
  { room: 'temporales', k: 5, W: 16, L: 22 },
  { room: 'videojuegos', k: 6, W: 11, L: 30 },
  { room: 'futuro', k: 7, W: 16, L: 18 },
]

let nebulaTex: THREE.CanvasTexture | null = null
function galaxyWindowMat() {
  if (!nebulaTex) {
    nebulaTex = new THREE.CanvasTexture(paint('nebula', 4242, 512))
    nebulaTex.colorSpace = THREE.SRGBColorSpace
  }
  return new THREE.MeshBasicMaterial({ map: nebulaTex, toneMapped: false })
}

/** Gable end wall with pointed top (closes a vault of the same width/rise). */
function gable(width: number, rise: number, depth: number, openings: Opening[]) {
  const s = new THREE.Shape()
  archPath(s, width + 0.8, rise + 0.4)
  for (const o of openings) {
    const p = new THREE.Path()
    if (o.kind === 'round') p.absarc(o.x, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2, true)
    else archPath(p, o.w, o.h, o.x, o.y)
    s.holes.push(p)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 })
  g.translate(0, 0, -depth / 2)
  return new THREE.Mesh(g, M.stone)
}

export function makeWing(root: THREE.Group, nav: Nav, def: (typeof WING_DEFS)[number], open: boolean): Wing {
  const ang = -(def.k * Math.PI) / 4
  const group = new THREE.Group()
  group.rotation.y = ang
  root.add(group)
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const floorY = def.rise ?? 0
  const w: Wing = {
    room: def.room,
    k: def.k,
    ang,
    W: def.W,
    L: def.L,
    floorY,
    open,
    group,
    world: (lx, lz, y = floorY) => new THREE.Vector3(lx * c + lz * s, y, -lx * s + lz * c),
    rect: (lcx, lcz, hw, hl, y0 = floorY, y1 = y0) => {
      nav.rect(def.room, lcx * c + lcz * s, -lcx * s + lcz * c, ang, hw, hl, y0, y1)
    },
    obstacle: (lx, lz, r) => nav.obstacle(lx * c + lz * s, -lx * s + lz * c, r),
    circle: (lcx, lcz, r) => nav.circle(def.room, lcx * c + lcz * s, -lcx * s + lcz * c, r, floorY),
  }
  // corridor
  const cLen = CORRIDOR_END - LOBBY_R
  const cor = vault(6, def.rise ? 9.5 : 7.5, cLen, 3)
  cor.position.z = -LOBBY_R
  group.add(cor)
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(6, cLen), floorMaterial(1))
  cf.rotation.x = -Math.PI / 2
  cf.position.set(0, 0.01, -LOBBY_R - cLen / 2)
  if (def.rise) {
    const steps = 12
    for (let i = 0; i < steps; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(5.6, ((i + 1) / steps) * def.rise, cLen / steps), i % 2 ? M.obsidian : M.stoneLight)
      st.position.set(0, (((i + 1) / steps) * def.rise) / 2, -LOBBY_R - (i + 0.5) * (cLen / steps))
      group.add(st)
      const led = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.03, 0.04), M.neonSoft)
      led.position.set(0, ((i + 1) / steps) * def.rise + 0.01, -LOBBY_R - i * (cLen / steps) - 0.02)
      group.add(led)
    }
  } else group.add(cf)
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, cLen), M.neon)
    strip.position.set(side * 2.85, (def.rise ?? 0) + 0.12, -LOBBY_R - cLen / 2)
    group.add(strip)
  }
  w.rect(0, -LOBBY_R - cLen / 2 + 1.25, 2.9, cLen / 2 + 2.5, 0, floorY)

  if (def.room === 'jardin') return w

  // room shell
  const H = 11
  const z0 = -CORRIDOR_END
  const shell = new THREE.Group()
  shell.position.set(0, floorY, z0)
  group.add(shell)
  const v = vault(def.W, H, def.L, 4)
  shell.add(v)
  const entry = gable(def.W, H, 0.8, [{ x: 0, y: 0, w: 5.2, h: 7.5 }, { x: 0, y: 8.2, w: 2.2, h: 2.2, kind: 'round' }])
  shell.add(entry)
  const back = gable(def.W, H, 0.8, [{ x: 0, y: 4.5, w: 4.2, h: 4.2, kind: 'round' }])
  back.position.z = -def.L
  shell.add(back)
  const rose = windowFill(4.2, 4.2, true)
  rose.position.set(0, 4.5, -def.L + 0.2)
  shell.add(rose)
  const roseBg = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), galaxyWindowMat())
  roseBg.position.set(0, 6.6, -def.L - 0.05)
  shell.add(roseBg)
  const door = archOutline(5.2, 7.5, 0.07)
  door.position.set(0, 0, 0.42)
  shell.add(door)
  const f = new THREE.Mesh(new THREE.PlaneGeometry(def.W, def.L), floorMaterial(2, new THREE.Vector2(0, 0)))
  f.rotation.x = -Math.PI / 2
  f.position.set(0, 0.01, -def.L / 2)
  shell.add(f)
  // side galaxy windows
  const nWin = Math.max(2, Math.floor(def.L / 6))
  const gmat = galaxyWindowMat()
  for (let i = 0; i < nWin; i++) {
    const z = -((i + 0.5) / nWin) * def.L
    for (const side of [-1, 1]) {
      const wf = windowFill(1.8, 4.2)
      wf.position.set(side * (def.W / 2 - 0.04), 2.6, z)
      wf.rotation.y = -side * (Math.PI / 2)
      shell.add(wf)
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 4.2), gmat)
      bg.position.set(side * (def.W / 2 + 0.02), 4.5, z)
      bg.rotation.y = -side * (Math.PI / 2)
      shell.add(bg)
    }
  }
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, def.L), M.neon)
    strip.position.set(side * (def.W / 2 - 0.1), 0.1, -def.L / 2)
    shell.add(strip)
    const top = strip.clone()
    top.position.y = 7.2
    shell.add(top)
  }
  if (open) {
    w.rect(0, z0 - def.L / 2, def.W / 2, def.L / 2 - 0.3)
  } else {
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 7.5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b7bff').multiplyScalar(0.9), transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }),
    )
    veil.position.set(0, 3.75, 0.5)
    shell.add(veil)
    const l = label('Próximamente', 'en construcción', 4.4)
    l.position.set(0, 3.5, 0.62)
    shell.add(l)
  }
  return w
}

export function buildLobby(root: THREE.Group, nav: Nav, content: Content) {
  const apo = LOBBY_R
  const side = 2 * apo * Math.tan(Math.PI / SIDES)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(apo + 1.2, 64), floorMaterial(2.2))
  floor.rotation.x = -Math.PI / 2
  root.add(floor)
  nav.circle('lobby', 0, 0, apo - 0.2)
  const doorGeo = wall(side + 0.02, LOBBY_H, 1, [
    { x: 0, y: 0, w: 5, h: 7.5 },
    { x: 0, y: 8.6, w: 3.6, h: 3.6, kind: 'round' },
  ])
  const winGeo = wall(side + 0.02, LOBBY_H, 1, [{ x: 0, y: 2.2, w: 4, h: 10.2 }])
  for (let i = 0; i < SIDES; i++) {
    const phi = (i * Math.PI * 2) / SIDES
    const dx = Math.sin(phi)
    const dz = -Math.cos(phi)
    const isDoor = i % 2 === 0
    const panel = new THREE.Group()
    panel.position.set(dx * (apo + 0.5), 0, dz * (apo + 0.5))
    panel.rotation.y = -phi
    panel.add(new THREE.Mesh(isDoor ? doorGeo : winGeo, M.stone))
    if (isDoor) {
      const k = i / 2
      const def = WING_DEFS.find((d) => d.k === k)!
      const info = content.rooms[def.room]
      const fr = archOutline(5, 7.5, 0.08)
      fr.position.z = 0.55
      panel.add(fr)
      const rw = windowFill(3.6, 3.6, true)
      rw.position.set(0, 8.6, 0)
      panel.add(rw)
      const isFuture = def.room === 'futuro'
      const name = isFuture ? content.settings.futureName : info.name
      const sign = label(name, isFuture && !content.settings.futureOpen ? 'próximamente' : info.subtitle, 5.2)
      sign.position.set(0, 8.05, 0.6)
      sign.scale.setScalar(0.85)
      panel.add(sign)
    } else {
      const wf = windowFill(4, 10.2)
      wf.position.set(0, 2.2, 0)
      panel.add(wf)
      const cand = candelabra()
      cand.position.set(0, 0, 1.7)
      panel.add(cand)
      const r = apo - 1.2
      nav.obstacle(dx * r, dz * r, 0.6)
    }
    root.add(panel)
    // columns at the joints
    const pj = phi + Math.PI / SIDES
    const cr = apo / Math.cos(Math.PI / SIDES) - 0.2
    const col = column(LOBBY_H, 0.42)
    col.position.set(Math.sin(pj) * cr, 0, -Math.cos(pj) * cr)
    root.add(col)
    const sp = spire(5.5, 0.7)
    sp.position.set(Math.sin(pj) * (cr + 0.6), LOBBY_H, -Math.cos(pj) * (cr + 0.6))
    root.add(sp)
  }
  // galleries / LED bands
  for (const y of [0.08, 7.9, LOBBY_H - 0.1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(apo / Math.cos(Math.PI / SIDES) - 0.75, 0.05, 6, SIDES), M.neon)
    ring.rotation.x = Math.PI / 2
    ring.rotation.z = Math.PI / SIDES
    ring.position.y = y
    root.add(ring)
  }
  // dome: glass shell + ribs so the galaxy is visible above
  const domeR = apo / Math.cos(Math.PI / SIDES) + 0.5
  const domeY = 0.92
  const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, SIDES, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass)
  dome.position.y = LOBBY_H
  dome.scale.y = domeY
  root.add(dome)
  for (let i = 0; i < SIDES; i++) {
    const phi = ((i + 0.5) * Math.PI * 2) / SIDES
    const pts: THREE.Vector3[] = []
    for (let j = 0; j <= 16; j++) {
      const th = (j / 16) * (Math.PI / 2) * 0.93
      pts.push(new THREE.Vector3(Math.sin(phi) * Math.cos(th) * domeR, LOBBY_H + Math.sin(th) * domeR * domeY, -Math.cos(phi) * Math.cos(th) * domeR))
    }
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, i % 2 ? 0.08 : 0.16, 5), i % 2 ? M.neonSoft : M.stoneLight)
    root.add(rib)
  }
  for (const t of [0.35, 0.7]) {
    const rr = Math.cos(t * (Math.PI / 2)) * domeR
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.06, 5, 48), M.neonSoft)
    ring.rotation.x = Math.PI / 2
    ring.position.y = LOBBY_H + Math.sin(t * (Math.PI / 2)) * domeR * domeY
    root.add(ring)
  }
  const oculusY = LOBBY_H + Math.sin(0.93 * (Math.PI / 2)) * domeR * domeY
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(0.93 * (Math.PI / 2)) * domeR, 0.12, 6, 32), M.neon)
  oculus.rotation.x = Math.PI / 2
  oculus.position.y = oculusY
  root.add(oculus)
  const top = spire(14, 1.4)
  top.position.y = oculusY + 0.5
  root.add(top)

  // altar under the cloud
  const altar = new THREE.Group()
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.45, 32), M.obsidian)
  disk.position.y = 0.22
  altar.add(disk)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.06, 6, 64), M.neon)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.47
  altar.add(ring)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.03, 6, 64), M.neonSoft)
  ring2.rotation.x = Math.PI / 2
  ring2.position.y = 0.48
  altar.add(ring2)
  root.add(altar)
  nav.obstacle(0, 0, 3.7)

  const chandeliers: THREE.Group[] = []
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const ch = chandelier(2.2, 18)
    ch.position.set(Math.cos(a) * 11.5, 10.5, Math.sin(a) * 11.5)
    root.add(ch)
    chandeliers.push(ch)
  }
  const title = label('Cybermuseo', 'art · technology · eternity', 9)
  title.position.set(0, 12.2, 0)
  title.userData.billboard = true
  root.add(title)
  return { chandeliers, altar, title }
}
