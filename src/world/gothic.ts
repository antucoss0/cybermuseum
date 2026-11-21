import * as THREE from 'three'
import { M, floorMaterial, shared } from './materials'

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
    else {
      const sill = o.y <= 0 ? 0.035 : 0
      archPath(p, o.w, o.h - sill, o.x, o.y + sill)
    }
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

function outline(w: number, h: number, thick: number, material: THREE.Material, round = false) {
  const p = new THREE.Path()
  if (round) p.absarc(0, h / 2, w / 2, 0, Math.PI * 2, false)
  else archPath(p, w, h, 0, 0, false)
  const pts = p.getPoints(32).map((v) => new THREE.Vector3(v.x, v.y, 0))
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, round), 64, thick, 6, round), material)
}

export function archivolt(w: number, h: number, round = false) {
  const g = new THREE.Group()
  for (const [offset, thickness] of [[0.34, 0.085], [0.18, 0.055], [0, 0.035]] as const) {
    const mould = outline(w + offset * 2, h + offset * 2, thickness, M.stoneLight, round)
    mould.position.z = offset * 0.28
    g.add(mould)
  }
  const led = outline(Math.max(0.6, w - 0.22), Math.max(0.8, h - 0.22), 0.012, M.neonSoft, round)
  led.position.z = 0.13
  g.add(led)
  return g
}

let stainedGlass: THREE.ShaderMaterial | null = null

function stainedGlassMaterial() {
  if (stainedGlass) return stainedGlass
  stainedGlass = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.time },
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 cellUv = vUv * vec2(7.0, 15.0);
        vec2 cell = fract(cellUv);
        vec2 id = floor(cellUv);
        float seed = hash(id);
        vec3 a = vec3(0.035, 0.09, 0.31);
        vec3 b = vec3(0.17, 0.035, 0.27);
        vec3 c = vec3(0.24, 0.035, 0.19);
        vec3 glass = mix(a, b, smoothstep(0.18, 0.82, seed));
        glass = mix(glass, c, smoothstep(0.5, 0.95, seed) * 0.45);
        float pulse = 0.9 + 0.08 * sin(uTime * 0.35 + seed * 18.0);
        float lead = 1.0 - smoothstep(0.015, 0.075, min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y)));
        vec3 color = glass * pulse * 0.72;
        color = mix(color, vec3(0.012, 0.018, 0.045), lead);
        gl_FragColor = vec4(color, 0.94);
      }`,
  })
  return stainedGlass
}

export function lancet(w: number, h: number, background?: THREE.Material) {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  archPath(shape, w, h)
  const geometry = new THREE.ShapeGeometry(shape, 18)
  if (background) {
    const back = new THREE.Mesh(geometry, background)
    back.position.z = -0.09
    g.add(back)
  }
  const glass = new THREE.Mesh(geometry, stainedGlassMaterial())
  glass.position.z = -0.035
  g.add(glass)
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.085, h * 0.76, 0.11), M.stoneLight)
  mullion.position.set(0, h * 0.39, 0.04)
  const transom = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.075, 0.11), M.stoneLight)
  transom.position.set(0, h * 0.52, 0.04)
  g.add(mullion, transom)
  const oculus = new THREE.TorusGeometry(w * 0.105, 0.045, 6, 18)
  for (const [x, y, scale] of [[0, h * 0.78, 1], [-w * 0.105, h * 0.68, 0.75], [w * 0.105, h * 0.68, 0.75]] as const) {
    const ring = new THREE.Mesh(oculus, M.stoneLight)
    ring.position.set(x, y, 0.05)
    ring.scale.setScalar(scale)
    g.add(ring)
  }
  const frame = archivolt(w, h)
  frame.position.z = 0.08
  g.add(frame)
  return g
}

/** Window glass and tracery; pointed windows use the same carved archivolt as the nave. */
export function windowFill(w: number, h: number, round = false, background?: THREE.Material) {
  if (!round) return lancet(w, h, background)
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  shape.absarc(0, h / 2, w / 2, 0, Math.PI * 2, false)
  const geometry = new THREE.ShapeGeometry(shape, 24)
  if (background) {
    const back = new THREE.Mesh(geometry, background)
    back.position.z = -0.09
    g.add(back)
  }
  const glass = new THREE.Mesh(geometry, stainedGlassMaterial())
  glass.position.z = -0.035
  g.add(glass)
  if (round) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.11), M.stoneLight)
      m.position.y = h / 2
      m.rotation.z = (i / 6) * Math.PI
      m.position.z = 0.04
      g.add(m)
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.18, 0.05, 6, 24), M.stoneLight)
    ring.position.y = h / 2
    ring.position.z = 0.05
    g.add(ring)
  }
  g.add(archivolt(w, h, true))
  return g
}

export function pier(height: number, radius = 0.45) {
  const g = new THREE.Group()
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.68, height, 12), M.stoneLight)
  core.position.y = height / 2
  g.add(core)
  const shaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.19, height, 6), M.stoneLight, 8)
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    matrix.makeTranslation(Math.cos(a) * radius * 0.75, height / 2, Math.sin(a) * radius * 0.75)
    shaft.setMatrixAt(i, matrix)
  }
  g.add(shaft)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.8, 0.28, radius * 2.8), M.obsidian)
  plinth.position.y = 0.14
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.15, radius * 1.38, 0.38, 8), M.stoneLight)
  base.position.y = 0.42
  g.add(plinth, base)
  const cap = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.98, 0.035, 6, 24), M.gold)
  cap.rotation.x = Math.PI / 2
  cap.position.y = height - 0.3
  g.add(cap)
  const leafGeo = new THREE.ConeGeometry(radius * 0.13, 0.36, 4)
  const leaves = new THREE.InstancedMesh(leafGeo, M.stoneLight, 8)
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3(1, 1, 1)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    p.set(Math.cos(a) * radius * 0.86, height - 0.48, Math.sin(a) * radius * 0.86)
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.cos(a) * 0.55)
    leaves.setMatrixAt(i, new THREE.Matrix4().compose(p, q, s))
  }
  g.add(leaves)
  return g
}

/** Kept for older room builders; all columns now use the clustered pier profile. */
export function column(height: number, radius = 0.45) {
  return pier(height, radius)
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

function vaultHeight(x: number, width: number, height: number) {
  const spring = height * 0.62
  const rise = height - spring
  const t = Math.min(1, Math.abs(x) / (width / 2))
  return spring + rise * Math.pow(1 - t, 0.72)
}

function vaultWeb(width: number, height: number, length: number, zStart: number) {
  const nx = 20
  const nz = 12
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= nz; j++) {
    const z = zStart - (j / nz) * length
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * width
      positions.push(x, vaultHeight(x, width, height) + 0.14, z)
      uvs.push(x / 2, -z / 2)
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      const b = a + nx + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function vaultCurve(points: THREE.Vector3[]) {
  return new THREE.CatmullRomCurve3(points, false, 'centripetal')
}

/** Four-part pointed barrel vault with carved ribs, dark webs, bosses and a fine ridge LED. */
export function ribVault(width: number, height: number, length: number, bay: number) {
  const g = new THREE.Group()
  const count = Math.max(1, Math.round(length / bay))
  const bayLength = length / count
  const webMaterial = M.stone.clone()
  webMaterial.side = THREE.DoubleSide
  for (let i = 0; i < count; i++) {
    const z = -i * bayLength
    const web = new THREE.Mesh(vaultWeb(width, height, bayLength, z), webMaterial)
    g.add(web)
    const mid = z - bayLength / 2
    const boss = new THREE.Group()
    const bossRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 6, 20), M.gold)
    bossRing.rotation.x = Math.PI / 2
    const bossCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.gold)
    boss.add(bossRing, bossCore)
    boss.position.set(0, height, mid)
    g.add(boss)
    for (const side of [-1, 1]) {
      const startZ = side < 0 ? z : z - bayLength
      const endZ = side < 0 ? z - bayLength : z
      const startX = side < 0 ? -width / 2 : width / 2
      const endX = -startX
      const diagonal = new THREE.Mesh(
        new THREE.TubeGeometry(
          vaultCurve([
            new THREE.Vector3(startX, height * 0.62, startZ),
            new THREE.Vector3(startX * 0.56, height * 0.84, startZ * 0.66 + endZ * 0.34),
            new THREE.Vector3(0, height, mid),
            new THREE.Vector3(endX * 0.56, height * 0.84, startZ * 0.34 + endZ * 0.66),
            new THREE.Vector3(endX, height * 0.62, endZ),
          ]),
          36,
          0.11,
          8,
          false,
        ),
        M.stoneLight,
      )
      g.add(diagonal)
    }
  }
  for (let i = 0; i <= count; i++) {
    const z = -i * bayLength
    const points: THREE.Vector3[] = []
    for (let j = 0; j <= 24; j++) {
      const x = (j / 24 - 0.5) * width
      points.push(new THREE.Vector3(x, vaultHeight(x, width, height), z))
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(vaultCurve(points), 48, 0.11, 8, false), M.stoneLight))
  }
  const ridge = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, height - 0.02, 0), new THREE.Vector3(0, height - 0.02, -length)), 1, 0.11, 8, false),
    M.stoneLight,
  )
  g.add(ridge)
  const led = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, height - 0.02, 0), new THREE.Vector3(0, height - 0.02, -length)), 1, 0.015, 6, false),
    M.neonSoft,
  )
  g.add(led)
  return g
}

export interface NaveBay {
  side: -1 | 1
  z: number
  chapel: boolean
  anchor: THREE.Vector3
  niche: THREE.Group
  chapelGroup: THREE.Group
}

export interface NaveDefinition {
  W: number
  H: number
  L: number
  bay: number
  entrance?: boolean
  apse?: boolean
  background?: THREE.Material
}

export interface Nave {
  group: THREE.Group
  bays: NaveBay[]
}

function texturedWallMaterial(width: number, height: number) {
  const material = M.stone.clone() as THREE.MeshStandardMaterial
  material.side = THREE.DoubleSide
  for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
    const map = material[key]
    if (!map) continue
    material[key] = map.clone()
    material[key]!.wrapS = material[key]!.wrapT = THREE.RepeatWrapping
    material[key]!.repeat.set(width / 2, height / 2)
    material[key]!.needsUpdate = true
  }
  return material
}

function gableWall(width: number, height: number, depth: number, openings: Opening[]) {
  const shape = new THREE.Shape()
  archPath(shape, width + 0.8, height)
  for (const opening of openings) {
    const hole = new THREE.Path()
    if (opening.kind === 'round') hole.absarc(opening.x, opening.y + opening.h / 2, opening.w / 2, 0, Math.PI * 2, true)
    else {
      const sill = opening.y <= 0 ? 0.035 : 0
      archPath(hole, opening.w, opening.h - sill, opening.x, opening.y + sill)
    }
    shape.holes.push(hole)
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 18 })
  geometry.translate(0, 0, -depth / 2)
  return new THREE.Mesh(geometry, M.stone)
}

function nicheVolumes(width: number, height: number, depth: number, background?: THREE.Material) {
  const niche = new THREE.Group()
  const side = (x: number) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, depth), M.stone)
    wall.position.set(x, height / 2, -depth / 2)
    niche.add(wall)
  }
  side(-width / 2)
  side(width / 2)
  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.18), M.obsidian)
  back.position.set(0, height / 2, -depth)
  niche.add(back)
  const glass = lancet(width * 0.76, height * 0.86, background)
  glass.position.set(0, height * 0.07, -depth - 0.11)
  niche.add(glass)

  const chapel = new THREE.Group()
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial(1.4))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.02, -depth / 2)
  const walls = [-1, 1].map((side) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, depth), M.stone)
    wall.position.set(side * width * 0.52, height / 2, -depth / 2)
    return wall
  })
  const roof = ribVault(width, height, depth, depth)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.22), M.stone)
  backWall.position.set(0, height / 2, -depth)
  chapel.add(floor, ...walls, roof, backWall)
  chapel.visible = false
  return { niche, chapel }
}

/** Side-aisle arcade with clustered piers, pointed blind niches, chapels and clerestory lancets. */
export function arcade(width: number, height: number, length: number, bay: number, opts: { background?: THREE.Material } = {}) {
  const group = new THREE.Group()
  const count = Math.max(1, Math.round(length / bay))
  const bayLength = length / count
  const openingWidth = Math.min(3.2, bayLength - 0.22)
  const openingHeight = Math.min(5.5, height * 0.6)
  const clerestoryHeight = height * 0.26
  const clerestoryY = height * 0.66
  const wallGeometry = wall(bayLength + 0.18, height, 0.58, [
    { x: 0, y: 0, w: openingWidth, h: openingHeight },
    { x: 0, y: clerestoryY, w: Math.min(1.55, bayLength * 0.32), h: clerestoryHeight },
  ])
  const wallMaterial = texturedWallMaterial(bayLength + 0.18, height)
  const bays: NaveBay[] = []
  for (const side of [-1, 1] as const) {
    const wallInstances = new THREE.InstancedMesh(wallGeometry, wallMaterial, count)
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < count; i++) {
      const z = -(i + 0.5) * bayLength
      position.set(side * width / 2, 0, z)
      rotation.setFromEuler(new THREE.Euler(0, -side * Math.PI / 2, 0))
      wallInstances.setMatrixAt(i, new THREE.Matrix4().compose(position, rotation, scale))
      const vol = nicheVolumes(openingWidth, openingHeight, 1.2, opts.background)
      vol.niche.position.set(side * width / 2, 0, z)
      vol.niche.rotation.y = -side * Math.PI / 2
      group.add(vol.niche)
      vol.chapel.position.set(side * width / 2, 0, z)
      vol.chapel.rotation.y = -side * Math.PI / 2
      group.add(vol.chapel)
      const window = lancet(Math.min(1.55, bayLength * 0.32), clerestoryHeight, opts.background)
      window.position.set(side * (width / 2 - 0.05), clerestoryY, z)
      window.rotation.y = -side * Math.PI / 2
      group.add(window)
      const trim = archivolt(openingWidth, openingHeight)
      trim.position.set(side * (width / 2 - 0.06), 0, z)
      trim.rotation.y = -side * Math.PI / 2
      group.add(trim)
      bays.push({
        side,
        z,
        chapel: false,
        anchor: new THREE.Vector3(side * (width / 2), 0, z),
        niche: vol.niche,
        chapelGroup: vol.chapel,
      })
    }
    wallInstances.instanceMatrix.needsUpdate = true
    group.add(wallInstances)
    for (let i = 0; i <= count; i++) {
      const pierGroup = pier(height * 0.62, Math.min(0.48, Math.max(0.3, width * 0.035)))
      pierGroup.position.set(side * (width / 2 + 0.12), 0, -i * bayLength)
      group.add(pierGroup)
    }
    const stringCourse = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, length), M.stoneLight)
    stringCourse.position.set(side * (width / 2 + 0.08), height * 0.56, -length / 2)
    group.add(stringCourse)
  }
  bays.sort((a, b) => a.z - b.z || a.side - b.side)
  return { group, bays }
}

/** Full nave shell with a marble floor, side arcades, pointed vault and rose apse. */
export function nave(definition: NaveDefinition): Nave {
  const group = new THREE.Group()
  const { W, H, L, bay } = definition
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMaterial(2))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.01, -L / 2)
  const sides = arcade(W, H, L, bay, { background: definition.background })
  group.add(floor, sides.group, ribVault(W, H, L, bay))

  if (definition.entrance !== false) {
    group.add(gableWall(W, H, 0.72, [{ x: 0, y: 0, w: 5.2, h: 7.5 }]))
    const portal = archivolt(5.2, 7.5)
    portal.position.z = 0.42
    group.add(portal)
  }
  if (definition.apse !== false) {
    const roseW = Math.min(4.2, W * 0.42)
    const roseY = H * 0.56
    const apse = gableWall(W, H, 0.72, [{ x: 0, y: roseY, w: roseW, h: roseW, kind: 'round' }])
    apse.position.z = -L
    group.add(apse)
    const rose = windowFill(roseW, roseW, true, definition.background)
    rose.position.set(0, roseY, -L - 0.39)
    group.add(rose)
  }
  return { group, bays: sides.bays }
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
