import * as THREE from 'three'
import { M } from './materials'

/** Pointed (ogival) arch outline from (-w/2,0) up to the apex and down to (w/2,0). */
export function archPath(path: THREE.Path | THREE.Shape, w: number, h: number, x = 0, y = 0, close = true) {
  const r = w * 0.5
  const spring = Math.max(0, h - r * 1.6)
  path.moveTo(x - r, y)
  path.lineTo(x - r, y + spring)
  path.quadraticCurveTo(x - r, y + spring + r * 1.2, x, y + h)
  path.quadraticCurveTo(x + r, y + spring + r * 1.2, x + r, y + spring)
  path.lineTo(x + r, y)
  if (close) path.lineTo(x - r, y)
  return path
}

export interface Opening {
  x: number
  y: number
  w: number
  h: number
  kind?: 'arch' | 'round'
}

/** Extruded wall (centered on x, base at y=0, facing +z) with arch / round openings. */
export function wall(width: number, height: number, depth: number, openings: Opening[] = []) {
  const s = new THREE.Shape()
  s.moveTo(-width / 2, 0)
  s.lineTo(width / 2, 0)
  s.lineTo(width / 2, height)
  s.lineTo(-width / 2, height)
  s.lineTo(-width / 2, 0)
  for (const o of openings) {
    const p = new THREE.Path()
    if (o.kind === 'round') p.absarc(o.x, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2, true)
    else archPath(p, o.w, o.h, o.x, o.y)
    s.holes.push(p)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Neon outline following an opening (for door frames and windows). */
export function archOutline(w: number, h: number, thick = 0.08, round = false) {
  const p = new THREE.Path()
  if (round) p.absarc(0, h / 2, w / 2, 0, Math.PI * 2, false)
  else archPath(p, w, h, 0, 0, false)
  const pts = p.getPoints(24).map((v) => new THREE.Vector3(v.x, v.y, 0))
  const curve = new THREE.CatmullRomCurve3(pts, round)
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 64, thick, 5, round), M.neon)
}

/** Window glass + tracery filling an arch opening. */
export function windowFill(w: number, h: number, round = false) {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  if (round) shape.absarc(0, h / 2, w / 2, 0, Math.PI * 2, false)
  else archPath(shape, w, h)
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10), M.glass)
  g.add(glass)
  const bar = (x: number, y: number, sx: number, sy: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.08), M.stoneLight)
    m.position.set(x, y, 0)
    g.add(m)
  }
  if (round) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.08), M.stoneLight)
      m.position.y = h / 2
      m.rotation.z = (i / 6) * Math.PI
      g.add(m)
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.18, 0.05, 6, 24), M.neonSoft)
    ring.position.y = h / 2
    g.add(ring)
  } else {
    bar(0, h * 0.45, 0.08, h * 0.9)
    bar(0, h * 0.42, w, 0.07)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.16, 0.04, 6, 20), M.stoneLight)
    ring.position.y = h * 0.78
    g.add(ring)
  }
  g.add(archOutline(w, h, 0.045, round))
  return g
}

/** Clustered gothic column with glowing capital ring. */
export function column(height: number, radius = 0.45) {
  const g = new THREE.Group()
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, height, 10), M.stone)
  core.position.y = height / 2
  g.add(core)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.32, radius * 0.36, height, 6), M.stoneLight)
    sh.position.set(Math.cos(a) * radius, height / 2, Math.sin(a) * radius)
    g.add(sh)
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.6, radius * 1.8, 0.6, 8), M.obsidian)
  base.position.y = 0.3
  g.add(base)
  const cap = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.25, 0.06, 6, 20), M.neon)
  cap.rotation.x = Math.PI / 2
  cap.position.y = height - 0.4
  g.add(cap)
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, height - 1.2, 0.05), M.neonSoft)
  led.position.set(0, height / 2, radius * 1.02)
  g.add(led)
  return g
}

/** Pointed vault shell (along -z, length L) with ribs every `ribEvery` meters. */
export function vault(width: number, rise: number, length: number, ribEvery = 4) {
  const g = new THREE.Group()
  const outer = new THREE.Shape()
  archPath(outer, width + 0.8, rise + 0.4, 0, 0, false)
  const inner: THREE.Vector2[] = new THREE.Path().getPoints()
  void inner
  const innerPath = new THREE.Path()
  archPath(innerPath, width, rise, 0, 0, false)
  const ipts = innerPath.getPoints(20).reverse()
  for (const p of ipts) outer.lineTo(p.x, p.y)
  outer.lineTo(-(width + 0.8) / 2, 0)
  const geo = new THREE.ExtrudeGeometry(outer, { depth: length, bevelEnabled: false, curveSegments: 16 })
  geo.translate(0, 0, -length)
  g.add(new THREE.Mesh(geo, M.stone))
  for (let z = 0; z <= length + 0.01; z += ribEvery) {
    const rib = archOutline(width - 0.1, rise - 0.05, 0.07)
    rib.position.z = -z
    g.add(rib)
  }
  // ridge LED
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, length), M.neonSoft)
  ridge.position.set(0, rise - 0.12, -length / 2)
  g.add(ridge)
  return g
}

/** Hanging neon chandelier. */
export function chandelier(radius = 2, candles = 16) {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 6, 40), M.stoneLight)
  ring.rotation.x = Math.PI / 2
  g.add(ring)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.6, 0.04, 6, 30), M.neonSoft)
  ring2.rotation.x = Math.PI / 2
  ring2.position.y = -0.6
  g.add(ring2)
  const candle = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6)
  const flame = new THREE.SphereGeometry(0.07, 6, 6)
  const ic = new THREE.InstancedMesh(candle, M.marble, candles)
  const ifl = new THREE.InstancedMesh(flame, M.neonWhite, candles)
  const m = new THREE.Matrix4()
  for (let i = 0; i < candles; i++) {
    const a = (i / candles) * Math.PI * 2
    m.makeTranslation(Math.cos(a) * radius, 0.2, Math.sin(a) * radius)
    ic.setMatrixAt(i, m)
    m.makeTranslation(Math.cos(a) * radius, 0.45, Math.sin(a) * radius)
    ifl.setMatrixAt(i, m)
  }
  g.add(ic, ifl)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 6, 4), M.stoneLight)
    chain.position.set(Math.cos(a) * radius * 0.5, 3, Math.sin(a) * radius * 0.5)
    chain.rotation.z = Math.cos(a) * 0.15
    chain.rotation.x = -Math.sin(a) * 0.15
    g.add(chain)
  }
  const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), M.neon)
  drop.position.y = -1.1
  drop.scale.y = 1.8
  g.add(drop)
  return g
}

/** Standing candelabra. */
export function candelabra() {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.4, 8), M.obsidian)
  pole.position.y = 1.2
  g.add(pole)
  const base = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 6), M.obsidian)
  base.position.y = 0.2
  g.add(base)
  for (let i = -1; i <= 1; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), M.marble)
    c.position.set(i * 0.35, 2.55 - Math.abs(i) * 0.15, 0)
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), M.neon)
    f.position.set(i * 0.35, 2.8 - Math.abs(i) * 0.15, 0)
    g.add(c, f)
  }
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 4, 16, Math.PI), M.obsidian)
  arm.position.y = 2.4
  arm.rotation.z = Math.PI
  g.add(arm)
  return g
}

export function ledStrip(length: number, axis: 'x' | 'z' = 'x') {
  const geo = axis === 'x' ? new THREE.BoxGeometry(length, 0.05, 0.05) : new THREE.BoxGeometry(0.05, 0.05, length)
  return new THREE.Mesh(geo, M.neon)
}

export function spire(h: number, r: number) {
  const g = new THREE.Group()
  const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), M.stone)
  c.position.y = h / 2
  g.add(c)
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.35), M.neon)
  tip.position.y = h + r * 0.3
  g.add(tip)
  return g
}
