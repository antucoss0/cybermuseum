import * as THREE from 'three'
import { CORRIDOR_END, LOBBY_H, LOBBY_R, SIDES, type Wing } from './building'
import { archOutline, archPath, wall, windowFill } from './gothic'
import { M, patchStone } from './materials'

/** Exterior architecture: masonry skins, buttresses, pitched roofs, the west front and the floating island. */
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const I = new THREE.Matrix4()

class Batch {
  private list: THREE.Matrix4[] = []
  constructor(
    private geo: THREE.BufferGeometry,
    private mat: THREE.Material,
  ) {}
  add(base: THREE.Matrix4, p: THREE.Vector3, s = V(1, 1, 1), ry = 0, rz = 0) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz))
    this.list.push(base.clone().multiply(new THREE.Matrix4().compose(p, q, s)))
  }
  build(root: THREE.Object3D) {
    if (!this.list.length) return
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.list.length)
    this.list.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
    root.add(im)
  }
}

function mosaic() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  const pal = ['#6b4cff', '#b89cff', '#3a6bff', '#ff6bd6', '#e8d9ff', '#2b1a66', '#8a5cff']
  g.fillStyle = '#05040a'
  g.fillRect(0, 0, 64, 128)
  for (let y = 0; y < 128; y += 8)
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = pal[(Math.random() * pal.length) | 0]
      g.globalAlpha = 0.55 + Math.random() * 0.45
      g.fillRect(x + 1, y + 1, 6, 6)
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function buildExterior(root: THREE.Group, wings: Wing[]) {
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const cbox = new THREE.BoxGeometry(1, 1, 1)
  const cone = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0)
  const oct = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0)
  const tri = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)])
  const prism = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false }).translate(0, 0, -1)
  const arch = new THREE.Shape()
  archPath(arch, 1, 1)
  const archGeo = new THREE.ShapeGeometry(arch, 8)
  const glassMat = new THREE.MeshBasicMaterial({ map: mosaic(), color: new THREE.Color(1, 1, 1).multiplyScalar(0.85), toneMapped: false })
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2a2440', metalness: 0.6, roughness: 0.36 })
  patchStone(roofMat, 0.5, 0.1, 0.18)

  const stone = new Batch(box, M.stone)
  const trim = new Batch(box, M.stoneLight)
  const spires = new Batch(cone, M.stoneLight)
  const lanterns = new Batch(oct, M.stoneLight)
  const struts = new Batch(cbox, M.stoneLight)
  const tips = new Batch(new THREE.OctahedronGeometry(1), M.neon)
  const lines = new Batch(box, M.neonSoft)
  const roofs = new Batch(prism, roofMat)
  const glass = new Batch(archGeo, glassMat)
  const frames = new Batch(archOutline(1.6, 4.6, 0.05).geometry, M.neonSoft)
  const pinnacle = (B: THREE.Matrix4, x: number, y: number, z: number, r: number, h: number) => {
    spires.add(B, V(x, y, z), V(r, h, r))
    tips.add(B, V(x, y + h + r * 0.3, z), V(r * 0.3, r * 0.3, r * 0.3))
  }
  const z0 = -CORRIDOR_END

  for (const w of wings) {
    w.group.updateMatrix()
    const B = w.group.matrix
    if (w.room === 'jardin') {
      westFront(w, B)
      continue
    }
    const { W, L, floorY: y0 } = w
    const hw = W / 2 + 0.5
    const n = Math.max(2, Math.round(L / 4.5))
    for (const s of [-1, 1]) {
      stone.add(B, V(s * (hw + 0.15), y0, z0 - L / 2), V(0.3, 8.6, L))
      trim.add(B, V(s * (hw + 0.25), y0 + 8.6, z0 - L / 2), V(0.8, 0.35, L + 0.4))
      lines.add(B, V(s * (hw + 0.66), y0 + 8.55, z0 - L / 2), V(0.05, 0.05, L + 0.4))
      for (let i = 0; i < n; i++) {
        const z = z0 - (i / n) * L
        trim.add(B, V(s * (hw + 0.9), y0, z), V(1.3, 3, 1.5))
        stone.add(B, V(s * (hw + 0.9), y0 + 3, z), V(1, 7.2, 1.2))
        lines.add(B, V(s * (hw + 1.42), y0 + 3, z), V(0.05, 7.2, 0.05))
        pinnacle(B, s * (hw + 0.9), y0 + 10.2, z, 0.5, 2.6)
        const zw = z0 - ((i + 0.5) / n) * L
        glass.add(B, V(s * (hw + 0.31), y0 + 2.2, zw), V(1.6, 4.6, 1), (s * Math.PI) / 2)
        frames.add(B, V(s * (hw + 0.33), y0 + 2.2, zw), V(1, 1, 1), (s * Math.PI) / 2)
      }
      // corner towers at the far gable
      stone.add(B, V(s * (hw + 0.9), y0, z0 - L - 0.4), V(2.4, 14, 2.4))
      lanterns.add(B, V(s * (hw + 0.9), y0 + 14, z0 - L - 0.4), V(0.9, 3, 0.9))
      pinnacle(B, s * (hw + 0.9), y0 + 17, z0 - L - 0.4, 1.1, 6)
      lines.add(B, V(s * (hw + 0.9) + 1.22 * s, y0, z0 - L - 0.4 - 1.22), V(0.05, 14, 0.05))
    }
    const rh = Math.max(4.2, W * 0.42)
    roofs.add(B, V(0, y0 + 8.8, z0 + 0.5), V(W + 2.4, rh, L + 1))
    lines.add(B, V(0, y0 + 8.8 + rh, z0 - L / 2), V(0.08, 0.08, L + 1))
    for (let i = 1; i < n; i++) tips.add(B, V(0, y0 + 9.3 + rh, z0 - (i / n) * L), V(0.22, 0.45, 0.22))
    // apse rose on the far gable
    glass.add(B, V(0, y0 + 4, z0 - L - 0.42), V(3, 5, 1), Math.PI)
    frames.add(B, V(0, y0 + 4.2, z0 - L - 0.44), V(3 / 1.6, 5 / 4.6, 1), Math.PI)
  }

  // lobby drum: buttress piers, flying struts and an outer ring of tower pinnacles
  for (let i = 0; i < SIDES; i++) {
    const pj = ((i + 0.5) / SIDES) * Math.PI * 2
    const dx = Math.sin(pj)
    const dz = -Math.cos(pj)
    const at = (r: number) => V(dx * r, 0, dz * r)
    const p = at(LOBBY_R + 2.4)
    stone.add(I, p, V(1.4, LOBBY_H + 1.5, 2.6), -pj)
    lines.add(I, at(LOBBY_R + 3.75), V(0.05, LOBBY_H + 1.5, 0.05), -pj)
    pinnacle(I, p.x, LOBBY_H + 1.5, p.z, 0.6, 3.5)
    const q = at(LOBBY_R + 7)
    trim.add(I, q, V(3, 4, 3), -pj)
    stone.add(I, V(q.x, 4, q.z), V(2.2, 11, 2.2), -pj)
    lanterns.add(I, V(q.x, 15, q.z), V(0.9, 2.4, 0.9))
    pinnacle(I, q.x, 17.4, q.z, 1, 6.5)
    const a = V(LOBBY_R + 5.9, 13.2)
    const b = V(LOBBY_R + 3.7, LOBBY_H - 0.6)
    const len = Math.hypot(a.x - b.x, a.y - b.y)
    const mid = at((a.x + b.x) / 2)
    mid.y = (a.y + b.y) / 2
    struts.add(I, mid, V(len, 0.55, 0.7), Math.PI / 2 - pj, Math.atan2(a.y - b.y, a.x - b.x))
  }

  function westFront(w: Wing, B: THREE.Matrix4) {
    const front = new THREE.Mesh(wall(30, 20, 1, [{ x: 0, y: 0, w: 6.4, h: 9.4 }, { x: 0, y: 11.5, w: 7, h: 7, kind: 'round' }]), M.stone)
    front.position.set(0, 0, z0 - 0.5)
    const gableTop = new THREE.Mesh(prism, M.stone)
    gableTop.scale.set(30, 9, 1)
    gableTop.position.set(0, 20, z0)
    const rose = new THREE.Mesh(new THREE.CircleGeometry(3.5, 40), glassMat)
    rose.position.set(0, 15, z0 - 0.5)
    rose.rotation.y = Math.PI
    const tracery = windowFill(7, 7, true)
    tracery.position.set(0, 11.5, z0 - 1.02)
    const ring = archOutline(7.2, 7.2, 0.1, true)
    ring.position.set(0, 11.4, z0 - 1.05)
    ring.rotation.y = Math.PI
    w.group.add(front, gableTop, rose, tracery, ring)
    for (const s of [-1, 1]) {
      w.obstacle(s * 4.2, z0 - 0.6, 1.1)
      const x = s * 17
      const z = z0 - 1.5
      trim.add(B, V(x, 0, z), V(5, 3, 5))
      stone.add(B, V(x, 3, z), V(4, 13, 4))
      stone.add(B, V(x, 16, z), V(3, 8, 3))
      lanterns.add(B, V(x, 24, z), V(1.3, 5, 1.3))
      pinnacle(B, x, 29, z, 1.7, 13)
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        lines.add(B, V(x + ox * 2.02, 3, z + oz * 2.02), V(0.06, 13, 0.06))
        pinnacle(B, x + ox * 1.5, 24, z + oz * 1.5, 0.3, 2.2)
      }
      glass.add(B, V(x, 6, z - 2.02), V(1.4, 6, 1), Math.PI)
      glass.add(B, V(x, 17.5, z - 1.52), V(1.1, 4, 1), Math.PI)
      pinnacle(B, s * 15, 20, z0 - 0.5, 0.6, 4)
      lines.add(B, V(s * 7.5, 0, z0 - 1.05), V(0.06, 20, 0.06))
    }
    pinnacle(B, 0, 29, z0 - 0.5, 0.7, 5)
  }

  for (const b of [stone, trim, spires, lanterns, struts, tips, lines, roofs, glass, frames]) b.build(root)

  // floating island the cathedral stands on
  const top = new THREE.Mesh(new THREE.CylinderGeometry(88, 84, 1.2, 64), new THREE.MeshStandardMaterial({ color: '#0a0910', roughness: 0.7, metalness: 0.2 }))
  top.position.y = -0.72
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(88, 0.02, 4, 128),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#b89cff').multiplyScalar(0.5), toneMapped: false }),
  )
  rim.rotation.x = Math.PI / 2
  rim.position.y = -0.12
  const rockGeo = new THREE.ConeGeometry(84, 64, 48, 10, true)
  const pos = rockGeo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (y > 31.9) continue
    const a = Math.atan2(z, x)
    const n = Math.sin(a * 5 + y * 0.21) * 0.5 + Math.sin(a * 13 - y * 0.37) * 0.3 + Math.sin(a * 29 + y * 0.9) * 0.2
    const k = 1 + 0.14 * n
    pos.setXYZ(i, x * k, y + n * 2, z * k)
  }
  rockGeo.computeVertexNormals()
  const rockMat = new THREE.MeshStandardMaterial({ color: '#0c0a12', roughness: 0.95, metalness: 0.1, flatShading: true, emissive: '#140c28', emissiveIntensity: 0.6, side: THREE.DoubleSide })
  const rock = new THREE.Mesh(rockGeo, rockMat)
  rock.rotation.x = Math.PI
  rock.position.y = -1.3 - 32
  root.add(top, rim, rock)
  const shards = new Batch(new THREE.OctahedronGeometry(1), M.neonSoft)
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + Math.sin(i * 7.3)
    const d = 0.25 + ((i * 0.618) % 1) * 0.6
    shards.add(I, V(Math.cos(a) * 84 * (1 - d) * 0.95, -1.3 - 64 * d, Math.sin(a) * 84 * (1 - d) * 0.95), V(0.8, 3 + (i % 4), 0.8), a, 0.6)
  }
  shards.build(root)
  // drifting debris ring
  const debris = new THREE.Group()
  const drift = new Batch(new THREE.DodecahedronGeometry(1, 0), rockMat)
  for (let i = 0; i < 64; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 100 + Math.random() * 60
    const s = 0.8 + Math.random() ** 3 * 7
    drift.add(I, V(Math.cos(a) * r, -40 + Math.random() * 55, Math.sin(a) * r), V(s, s * (0.6 + Math.random() * 0.6), s), a, Math.random() * 3)
  }
  drift.build(debris)
  root.add(debris)
  return {
    tick(t: number) {
      debris.rotation.y = t * 0.004
    },
  }
}
