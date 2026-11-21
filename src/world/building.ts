import { L, tx } from '../core/i18n'
import * as THREE from 'three'
import type { Content, RoomId } from '../content/types'
import { paint } from '../core/gen2d'
import { Nav } from './nav'
import { M, floorMaterial, label, shared } from './materials'
import { archivolt, candelabra, chandelier, column, nave as buildNave, spire, type NaveBay, wall, windowFill } from './gothic'

export const LOBBY_R = 26
export const LOBBY_H = 18
export const SIDES = 16
export const CORRIDOR_END = 36

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
  H: number
  floorY: number
  open: boolean
  group: THREE.Group
  corridorGroup: THREE.Group
  shellGroup: THREE.Group
  corridorBays: NaveBay[]
  bays: NaveBay[]
  world(lx: number, lz: number, y?: number): THREE.Vector3
  rect(lcx: number, lcz: number, hw: number, hl: number, y0?: number, y1?: number, first?: boolean): void
  obstacle(lx: number, lz: number, r: number): void
  circle(lcx: number, lcz: number, r: number): void
}

export const WING_DEFS: { room: RoomId; k: number; W: number; L: number; H: number; rise?: number }[] = [
  { room: 'videosala', k: 0, W: 18, L: 22, H: 12 },
  { room: 'escultura', k: 1, W: 22, L: 28, H: 14, rise: 2.4 },
  { room: 'pintura', k: 2, W: 14, L: 26, H: 11 },
  { room: 'tienda', k: 3, W: 16, L: 18, H: 10 },
  { room: 'jardin', k: 4, W: 44, L: 44, H: 10 },
  { room: 'temporales', k: 5, W: 16, L: 22, H: 12 },
  { room: 'videojuegos', k: 6, W: 11, L: 30, H: 10 },
  { room: 'futuro', k: 7, W: 16, L: 18, H: 14 },
]

let nebulaTex: THREE.CanvasTexture | null = null
let galaxyMat: THREE.ShaderMaterial | null = null
/** Window view onto the outer universe: drifting, swirling nebula with pulsing stars. */
export function galaxyWindowMat() {
  if (galaxyMat) return galaxyMat
  nebulaTex = new THREE.CanvasTexture(paint('nebula', 4242, 512))
  nebulaTex.colorSpace = THREE.SRGBColorSpace
  nebulaTex.wrapS = nebulaTex.wrapT = THREE.MirroredRepeatWrapping
  galaxyMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: nebulaTex }, uTime: shared.time, uEnergy: shared.energy },
    toneMapped: false,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uTime; uniform float uEnergy; varying vec2 vUv; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      vec3 stars(vec2 uv, float sc, float sp){
        vec2 g = uv*sc; vec2 id = floor(g); vec2 f = fract(g)-0.5;
        float r = h(id); vec2 o = vec2(h(id+3.1), h(id+7.7))-0.5;
        float d = length(f - o*0.7);
        float tw = 0.5 + 0.5*sin(uTime*(1.5+r*4.0)*sp + r*40.0);
        float s = smoothstep(0.06*r, 0.0, d) * step(0.72, r) * (0.3 + tw*1.4);
        return mix(vec3(0.75,0.7,1.0), vec3(1.0,0.9,0.95), h(id+1.0)) * s;
      }
      void main(){
        vec2 seed = vec2(vW.x*0.031 + vW.z*0.017, vW.y*0.02);
        vec2 c = vUv - 0.5;
        float a = uTime*0.03 + length(c)*1.6;
        mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec2 uv = R*c*0.8 + 0.5 + seed + vec2(uTime*0.004, 0.0);
        vec3 neb = texture2D(uMap, uv).rgb;
        neb += texture2D(uMap, uv*1.7 - seed*2.0 + uTime*0.006).rgb*0.45;
        neb *= 0.75 + 0.25*sin(uTime*0.4 + seed.x*10.0) + uEnergy*0.8;
        vec3 col = neb + stars(vUv + seed, 40.0, 1.0) + stars(vUv*1.3 + seed*2.0, 90.0, 1.7)*0.7;
        float core = exp(-dot(c,c)*30.0) * (0.25 + 0.15*sin(uTime*0.7));
        col += vec3(0.8,0.7,1.0)*core*0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  return galaxyMat
}

export function makeWing(root: THREE.Group, nav: Nav, def: (typeof WING_DEFS)[number], open: boolean): Wing {
  const ang = -(def.k * Math.PI) / 4
  const group = new THREE.Group()
  group.name = `wing-content-${def.room}`
  group.rotation.y = ang
  const corridorGroup = new THREE.Group()
  corridorGroup.name = `wing-corridor-${def.room}`
  corridorGroup.rotation.y = ang
  const shellGroup = new THREE.Group()
  shellGroup.name = `wing-shell-${def.room}`
  shellGroup.rotation.y = ang
  root.add(corridorGroup, shellGroup, group)
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const floorY = def.rise ?? 0
  const w: Wing = {
    room: def.room,
    k: def.k,
    ang,
    W: def.W,
    L: def.L,
    H: def.H,
    floorY,
    open,
    group,
    corridorGroup,
    shellGroup,
    corridorBays: [],
    bays: [],
    world: (lx, lz, y = floorY) => new THREE.Vector3(lx * c + lz * s, y, -lx * s + lz * c),
    rect: (lcx, lcz, hw, hl, y0 = floorY, y1 = y0, first = false) => {
      nav.rect(def.room, lcx * c + lcz * s, -lcx * s + lcz * c, ang, hw, hl, y0, y1, undefined, first)
    },
    obstacle: (lx, lz, r) => nav.obstacle(lx * c + lz * s, -lx * s + lz * c, r),
    circle: (lcx, lcz, r) => nav.circle(def.room, lcx * c + lcz * s, -lcx * s + lcz * c, r, floorY),
  }
  // Short narthex
  const cLen = CORRIDOR_END - LOBBY_R
  const narthex = buildNave({ W: 6, H: def.rise ? 9.5 : 7.5, L: cLen, bay: 3.3, entrance: false, apse: false, background: galaxyWindowMat() })
  narthex.group.name = `narthex-${def.room}`
  narthex.group.position.z = -LOBBY_R
  corridorGroup.add(narthex.group)
  w.corridorBays = narthex.bays.map((slot) => ({
    ...slot,
    z: slot.z - LOBBY_R,
    anchor: slot.anchor.clone().add(new THREE.Vector3(0, 0, -LOBBY_R)),
  }))
  if (def.rise) {
    const steps = 12
    for (let i = 0; i < steps; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(5.6, ((i + 1) / steps) * def.rise, cLen / steps), i % 2 ? M.obsidian : M.stoneLight)
      st.position.set(0, (((i + 1) / steps) * def.rise) / 2, -LOBBY_R - (i + 0.5) * (cLen / steps))
      corridorGroup.add(st)
      const led = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.03, 0.04), M.neonSoft)
      led.position.set(0, ((i + 1) / steps) * def.rise + 0.01, -LOBBY_R - i * (cLen / steps) - 0.02)
      corridorGroup.add(led)
    }
  }
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, cLen), M.neonSoft)
    strip.position.set(side * 2.82, (def.rise ?? 0) + 0.12, -LOBBY_R - cLen / 2)
    corridorGroup.add(strip)
  }
  w.rect(0, -LOBBY_R - cLen / 2 + 1.25, 2.9, cLen / 2 + 2.5, 0, floorY)

  if (def.room === 'jardin') return w

  // Exhibition nave
  const z0 = -CORRIDOR_END
  const bayCount = Math.max(2, Math.round(def.L / (def.W / 2)))
  const roomNave = buildNave({ W: def.W, H: def.H, L: def.L, bay: def.L / bayCount, background: galaxyWindowMat() })
  roomNave.group.name = `nave-${def.room}`
  roomNave.group.position.set(0, floorY, z0)
  shellGroup.add(roomNave.group)
  w.bays = roomNave.bays.map((slot) => ({
    ...slot,
    z: slot.z + z0,
    anchor: slot.anchor.clone().add(new THREE.Vector3(0, floorY, z0)),
  }))
  if (open) {
    w.rect(0, z0 - def.L / 2, def.W / 2, def.L / 2 - 0.3)
  } else {
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 7.5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b7bff').multiplyScalar(0.9), transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }),
    )
    veil.position.set(0, 3.75, 0.5)
    roomNave.group.add(veil)
    const l = label(L('Próximamente', 'Coming soon'), L('en construcción', 'under construction'), 4.4)
    l.position.set(0, 3.5, 0.62)
    roomNave.group.add(l)
  }
  return w
}

export function buildLobby(parent: THREE.Group, nav: Nav, content: Content) {
  const root = new THREE.Group()
  root.name = 'lobby'
  parent.add(root)
  const apo = LOBBY_R
  const side = 2 * apo * Math.tan(Math.PI / SIDES)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(apo + 1.2, 64), floorMaterial(2.2))
  floor.rotation.x = -Math.PI / 2
  root.add(floor)
  const floorGlow = (radius: number, color: string, strength: number) => {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uStrength;
          void main(){ float a=pow(max(0.0,1.0-dot(vUv,vUv)),2.2)*uStrength; gl_FragColor=vec4(uColor*a,a); }`,
      }),
    )
    glow.rotation.x = -Math.PI / 2
    glow.position.y = 0.025
    root.add(glow)
    return glow
  }
  floorGlow(10, '#9e8bff', 0.035)
  nav.circle('lobby', 0, 0, apo - 0.2)
  const doorGeo = wall(side + 0.02, LOBBY_H, 1, [
    { x: 0, y: 0, w: 5, h: 7.5 },
    { x: 0, y: 8.6, w: 3.6, h: 3.6, kind: 'round' },
  ])
  const winGeo = wall(side + 0.02, LOBBY_H, 1, [
    { x: 0, y: 2.2, w: 4.6, h: 11.5 },
    { x: 0, y: 14.4, w: 2.6, h: 2.6, kind: 'round' },
  ])
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
      const fr = archivolt(5, 7.5)
      fr.position.z = 0.55
      panel.add(fr)
      const rw = windowFill(3.6, 3.6, true)
      rw.position.set(0, 8.6, 0)
      panel.add(rw)
      const isFuture = def.room === 'futuro'
      const name = isFuture ? content.settings.futureName : tx(info, 'name')
      const sign = label(name, isFuture && !content.settings.futureOpen ? L('próximamente', 'coming soon') : tx(info, 'subtitle'), 5.2)
      sign.position.set(0, 8.05, 0.6)
      sign.scale.setScalar(0.85)
      panel.add(sign)
    } else {
      const wf = windowFill(4.6, 11.5)
      wf.position.set(0, 2.2, 0)
      panel.add(wf)
      const view = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 12), galaxyWindowMat())
      view.position.set(0, 2.2 + 6, -0.9)
      panel.add(view)
      const ow = windowFill(2.6, 2.6, true)
      ow.position.set(0, 14.4, 0)
      panel.add(ow)
      const ov = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), galaxyWindowMat())
      ov.position.set(0, 15.7, -0.9)
      panel.add(ov)
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
  for (const y of [0.08, 8.2, 13.6, LOBBY_H - 0.1]) {
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
  // Renaissance coffers (lacunaria) on the inner shell, gilded edges catching the cloud light
  {
    const rows = 6
    const per = SIDES * 2
    const cof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.35), M.stoneLight, rows * per)
    const rim = new THREE.InstancedMesh(new THREE.TorusGeometry(0.62, 0.035, 4, 4), M.gold, rows * per)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3()
    let n = 0
    for (let j = 0; j < rows; j++) {
      const th = (0.08 + (j / rows) * 0.74) * (Math.PI / 2)
      const ring = Math.cos(th) * (domeR - 0.25)
      const size = ((Math.PI * 2 * ring) / per) * 0.78
      for (let i = 0; i < per; i++) {
        const phi = ((i + (j % 2) * 0.5) / per) * Math.PI * 2
        v.set(Math.sin(phi) * ring, LOBBY_H + Math.sin(th) * (domeR - 0.25) * domeY, -Math.cos(phi) * ring)
        const look = new THREE.Matrix4().lookAt(v, new THREE.Vector3(0, LOBBY_H, 0), new THREE.Vector3(0, 1, 0))
        q.setFromRotationMatrix(look)
        sc.set(size, size * 0.9, 1)
        m.compose(v, q, sc)
        cof.setMatrixAt(n, m)
        sc.set(size, size * 0.9, 1)
        const rq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4))
        m.compose(v.clone().multiplyScalar(0.995), rq, sc)
        rim.setMatrixAt(n, m)
        n++
      }
    }
    cof.material = M.coffer
    root.add(cof, rim)
  }
  for (const y of [LOBBY_H + 0.15, LOBBY_H + 0.55]) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(domeR - 0.1, 0.12, 6, 96), M.gold)
    g.rotation.x = Math.PI / 2
    g.position.y = y
    root.add(g)
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
  const top = spire(18, 1.8)
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
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.4, oculusY, 48, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uTime: shared.time, uEnergy: shared.energy, uLav: shared.lavender },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `uniform float uTime; uniform float uEnergy; uniform vec3 uLav; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          float edge = pow(1.0 - abs(dot(vN, vV)), 2.0);
          float streak = 0.5 + 0.5*sin(vUv.x*60.0 + vUv.y*8.0 - uTime*1.2);
          float flow = 0.5 + 0.5*sin(vUv.y*24.0 - uTime*3.0*(1.0+uEnergy));
          float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
          float a = (edge*0.55 + streak*flow*0.12) * fade * (0.8 + uEnergy*1.2);
          gl_FragColor = vec4(mix(uLav, vec3(1.0), 0.25+uEnergy*0.3) * a, a);
        }`,
    }),
  )
  beam.position.y = oculusY / 2
  beam.renderOrder = 2
  altar.add(beam)
  root.add(altar)
  nav.obstacle(0, 0, 3.7)

  const chandeliers: THREE.Group[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const ch = chandelier(i % 2 ? 1.8 : 2.4, i % 2 ? 14 : 20)
    ch.position.set(Math.cos(a) * 17, i % 2 ? 13.5 : 12.5, Math.sin(a) * 17)
    root.add(ch)
    const pool = floorGlow(4.5, '#b89cff', 0.045)
    pool.position.set(ch.position.x, 0.026, ch.position.z)
    chandeliers.push(ch)
  }
  const title = label('Cyber Museum', 'art · technology · eternity', 9)
  title.position.set(0, LOBBY_H + 7, 0)
  title.scale.setScalar(1.8)
  title.userData.billboard = true
  root.add(title)
  return { group: root, chandeliers, altar, title }
}
