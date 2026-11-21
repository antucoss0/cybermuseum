import { L, tx } from '../core/i18n'
import * as THREE from 'three'
import type { Artwork, Content, GameDoor, Product, RoomId } from '../content/types'
import { mulberry32 } from '../core/util'
import type { PaymentEvent } from '../payments/bus'
import { M, label, shared } from './materials'
import { P, pbr } from './pbr'
import { archOutline, candelabra, chandelier, column } from './gothic'
import { paintingStele, sculpture, textureFor } from './art'
import { CORRIDOR_END, galaxyWindowMat, type Interactable, type Wing } from './building'
import { fit, later, loadGLB, loadPLY, tame } from './assets'
import { shopDecor } from './shop'
const shopTicks: ((t: number) => void)[] = []
export const tickShop = (t: number) => shopTicks.forEach((f) => f(t))

const gold = () => M.gold
/** Ambient motes that give every hall its own atmosphere (colour, density, motion). */
function motes(w: Wing, color: string, n: number, spread: [number, number, number], rise = 0.3, size = 0.08) {
  const pos = new Float32Array(n * 3)
  const rng = mulberry32(n * 7 + w.k)
  for (let i = 0; i < n; i++) pos.set([(rng() - 0.5) * spread[0], rng() * spread[1], -rng() * spread[2]], i * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), size, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const pts = new THREE.Points(geo, mat)
  pts.position.set(0, w.floorY, z0)
  w.group.add(pts)
  const base = pos.slice()
  return (t: number) => {
    const a = geo.attributes.position.array as Float32Array
    for (let i = 0; i < n; i++) {
      a[i * 3] = base[i * 3] + Math.sin(t * 0.3 + i) * 0.4
      a[i * 3 + 1] = (base[i * 3 + 1] + t * rise * (0.5 + (i % 7) / 7)) % spread[1]
      a[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.25 + i * 1.3) * 0.4
    }
    geo.attributes.position.needsUpdate = true
    mat.opacity = 0.55 + Math.sin(t * 1.3) * 0.25
  }
}
const halo = (r: number, mat: THREE.Material = M.neon, tube = 0.04) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 96), mat)
  m.rotation.x = Math.PI / 2
  return m
}

export interface Hooks {
  openArt(a: Artwork): void
  openShop(p?: Product): void
  openGame(g: GameDoor): void
  openCall(): void
  openEvents(): void
  donate(): void
  nextFilm(): void
  openCatalog(play: (i: number) => void): void
  sit(eye: THREE.Vector3, look: THREE.Vector3): void
}

export interface RoomRuntime {
  tick(dt: number, t: number, here: RoomId): void
  addPlant?(p: PaymentEvent, fresh: boolean): void
}

type Builder = (w: Wing, c: Content, add: (i: Interactable) => void, hooks: Hooks) => RoomRuntime

const z0 = -CORRIDOR_END
const local = (w: Wing, obj: THREE.Object3D, lx: number, lz: number, y = 0, ry = 0) => {
  obj.position.set(lx, y + w.floorY, lz)
  obj.rotation.y = ry
  w.group.add(obj)
}
const roomLight = (w: Wing, color = '#b89cff', intensity = 60) => {
  const l = new THREE.PointLight(color, intensity, 0, 1.6)
  local(w, l, 0, z0 - w.L / 2, 8)
}

function gallery(w: Wing, c: Content, add: (i: Interactable) => void, hooks: Hooks, list: Artwork[]) {
  const anchors = [...w.bays, ...w.corridorBays].filter((bay) => !bay.chapel)
  list.forEach((a, i) => {
    const bay = anchors[i]
    const overflow = i - anchors.length
    const side = bay?.side ?? (overflow % 2 === 0 ? -1 : 1)
    const lx = bay ? bay.anchor.x - side * 1.15 : side * (w.W / 4)
    const bayLength = w.L / Math.max(1, Math.round(w.L / (w.W / 2)))
    const lz = bay?.z ?? z0 - w.L + bayLength / 2 + Math.floor(overflow / 2) * bayLength
    const st = paintingStele(a, 2.4, !bay)
    local(w, st, lx, lz, 0, side * -Math.PI / 2)
    w.obstacle(lx, lz, 1.0)
    add({ id: a.id, pos: w.world(lx - side * 1.6, lz), r: 2.2, label: `${L('Ver', 'View')} · ${tx(a, 'title')}`, room: w.room, action: () => hooks.openArt(a) })
  })
  void c
}

const builders: Partial<Record<RoomId, Builder>> = {
  pintura(w, c, add, hooks) {
    roomLight(w)
    gallery(w, c, add, hooks, c.artworks.filter((a) => a.room === 'pintura'))
    for (const f of [0.25, 0.5, 0.75]) {
      const ch = chandelier(1.6, 14)
      local(w, ch, 0, z0 - w.L * f, 8)
    }
    // wainscot, crown moulding and a velvet runner: the classic salon
    for (const s of [-1, 1]) {
      const wain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, w.L - 1), new THREE.MeshStandardMaterial({ color: '#241238', roughness: 0.6, metalness: 0.2 }))
      local(w, wain, s * (w.W / 2 - 0.1), z0 - w.L / 2, 0.55)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, w.L - 1), gold())
      local(w, rail, s * (w.W / 2 - 0.12), z0 - w.L / 2, 1.12)
      const crown = rail.clone()
      local(w, crown, s * (w.W / 2 - 0.12), z0 - w.L / 2, 7.6)
    }
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, w.L - 2), new THREE.MeshStandardMaterial({ color: '#3a0f3f', roughness: 0.95 }))
    runner.rotation.x = -Math.PI / 2
    local(w, runner, 0, z0 - w.L / 2, 0.02)
    for (const f of [0.33, 0.66]) {
      const bench = new THREE.Group()
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 2.4), new THREE.MeshStandardMaterial({ color: '#4a1a55', roughness: 0.85 }))
      seat.position.y = 0.48
      for (const dz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.1), gold())
        leg.position.set(0, 0.21, dz * 1.05)
        bench.add(leg)
      }
      bench.add(seat)
      local(w, bench, 0, z0 - w.L * f)
      w.obstacle(0, z0 - w.L * f, 1.1)
    }
    // a living canvas: a digital painting that slowly repaints itself
    const living = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3.6),
      new THREE.ShaderMaterial({
        uniforms: { uTime: shared.time, uEnergy: shared.energy },
        toneMapped: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform float uEnergy; varying vec2 vUv;
          vec3 pal(float t){ return 0.5+0.5*cos(6.2831*(vec3(0.75,0.6,0.9)*t+vec3(0.55,0.3,0.15))); }
          void main(){ vec2 p = vUv*vec2(3.0,1.8); float t = uTime*0.08;
            for(int i=1;i<6;i++){ float fi=float(i); p += vec2(sin(p.y*fi*0.9+t*fi)*0.45/fi, cos(p.x*fi*0.7-t*fi*1.3)*0.45/fi); }
            float v = sin(p.x+p.y)*0.5+0.5; vec3 col = pal(v*0.6+t*0.2)*(0.35+0.4*v) * (0.8+uEnergy);
            col *= smoothstep(0.0,0.04,vUv.x)*smoothstep(1.0,0.96,vUv.x)*smoothstep(0.0,0.06,vUv.y)*smoothstep(1.0,0.94,vUv.y);
            gl_FragColor = vec4(col*0.9,1.0); }`,
      }),
    )
    local(w, living, 0, z0 - w.L + 0.55, 4.4)
    const lf = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.1, 0.15), gold())
    local(w, lf, 0, z0 - w.L + 0.45, 4.4)
    const t = label(tx(c.rooms.pintura, 'name'), tx(c.rooms.pintura, 'subtitle'), 6)
    local(w, t, 0, z0 - w.L + 0.6, 7.6)
    const dust = motes(w, '#ffe2b8', 260, [w.W - 2, 7, w.L], 0.08, 0.05)
    return { tick: (_dt, tm, here) => here === 'pintura' && dust(tm) }
  },
  temporales(w, c, add, hooks) {
    roomLight(w, '#c7a6ff')
    gallery(w, c, add, hooks, c.artworks.filter((a) => a.room === 'temporales'))
    const t = label(tx(c.temp, 'title'), `${L('curaduría', 'curated by')} · ${c.temp.curator}`, 7)
    local(w, t, 0, z0 - 1.2, 8.3, Math.PI)
    const t2 = label(tx(c.temp, 'title'), `${L('curaduría', 'curated by')} · ${c.temp.curator}`, 7)
    local(w, t2, 0, z0 - w.L + 0.6, 8.6)
    // call-for-artists kiosk
    const k = new THREE.Group()
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.8), M.obsidian)
    slab.position.y = 0.6
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b89cff').multiplyScalar(1.3), toneMapped: false }))
    screen.position.set(0, 1.25, 0)
    screen.rotation.x = -0.5
    k.add(slab, screen)
    const kl = label(c.temp.callOpen ? L('Convocatoria', 'Open call') : L('Eventos', 'Events'), c.temp.callOpen ? tx(c.temp, 'callTitle') : L('agenda del museo', 'museum calendar'), 3)
    kl.position.y = 2.1
    k.add(kl)
    local(w, k, 0, z0 - w.L + 3.5, 0, 0)
    w.obstacle(0, z0 - w.L + 3.5, 1)
    const magenta = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6bd6').multiplyScalar(1.5), toneMapped: false })
    const rings: THREE.Object3D[] = []
    for (let i = 0; i < 5; i++) {
      const r = halo(1.4 + i * 0.55, i % 2 ? gold() : magenta, 0.03 + (i % 2) * 0.02)
      r.rotation.set(Math.PI / 2 + i * 0.3, i * 0.7, 0)
      local(w, r, 0, z0 - w.L + 3.5, 4.4)
      r.rotation.set(Math.PI / 2 + i * 0.3, i * 0.7, 0)
      rings.push(r)
    }
    const callLight = new THREE.PointLight('#ff6bd6', 30, 14, 1.6)
    local(w, callLight, 0, z0 - w.L + 4, 4.5)
    const banner = label(c.temp.callOpen ? L('CONVOCATORIA ABIERTA', 'OPEN CALL') : L('PRÓXIMA EXPOSICIÓN', 'NEXT SHOW'), tx(c.temp, 'callTitle'), 6, '#ffd6f4')
    local(w, banner, 0, z0 - w.L + 3.5, 7.4)
    const sparks = motes(w, '#ff9be9', 320, [w.W - 2, 9, w.L], 0.5, 0.07)
    add({ id: 'call', pos: w.world(0, z0 - w.L + 5.4), r: 2, label: c.temp.callOpen ? L('Postular a la convocatoria', 'Apply to the open call') : L('Ver eventos', 'See events'), room: w.room, action: () => (c.temp.callOpen ? hooks.openCall() : hooks.openEvents()) })
    return {
      tick: (_dt, tm, here) => {
        if (here !== 'temporales') return
        rings.forEach((r, i) => ((r.rotation.y = tm * (0.3 + i * 0.12) * (i % 2 ? 1 : -1)), (r.rotation.z = tm * 0.2 + i)))
        callLight.intensity = 25 + Math.sin(tm * 2) * 10
        sparks(tm)
      },
    }
  },
  escultura(w, c, add, hooks) {
    roomLight(w, '#d9ccff', 80)
    const list = c.artworks.filter((a) => a.room === 'escultura')
    const ticks: ((t: number) => void)[] = []
    const cols = 3
    list.forEach((a, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const lx = (col - (cols - 1) / 2) * 5
      const lz = z0 - 5 - row * 7
      const s = sculpture(a)
      local(w, s.group, lx, lz)
      ticks.push(s.tick)
      w.obstacle(lx, lz, 1.2)
      add({ id: a.id, pos: w.world(lx, lz + 1.9), r: 1.8, label: `${L('Ver', 'View')} · ${tx(a, 'title')}`, room: w.room, action: () => hooks.openArt(a) })
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#b89cff', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }))
      local(w, spot, lx, lz, 5)
    })
    const t = label(tx(c.rooms.escultura, 'name'), tx(c.rooms.escultura, 'subtitle'), 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    const mixers: THREE.AnimationMixer[] = []
    const turn: THREE.Object3D[] = []
    const plinth = (lx: number, lz: number, r = 1.3) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.9, 48), P.marbleBlack)
      local(w, p, lx, lz, 0.45)
      const ring = halo(r * 1.05, gold(), 0.03)
      local(w, ring, lx, lz, 0.92)
      ring.rotation.x = Math.PI / 2
      w.obstacle(lx, lz, r + 0.2)
    }
    // Lucy (Stanford scan) as an iridescent marble angel at the apse
    const lucyZ = z0 - w.L + 3.2
    plinth(0, lucyZ, 1.6)
    later(() =>
      loadPLY('Lucy100k.ply').then((geo) => {
        const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#e9e4ff', roughness: 0.25, metalness: 0.1, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.6, sheenColor: new THREE.Color('#b89cff') }))
        m.rotation.x = -Math.PI / 2
        const g = new THREE.Group()
        g.add(m)
        fit(g, 4.2)
        const holder = new THREE.Group()
        holder.add(g)
        local(w, holder, 0, lucyZ, 0.9)
        turn.push(holder)
      }),
    )
    const lucyLight = new THREE.SpotLight('#e2d6ff', 160, 16, 0.4, 0.6, 1.2)
    local(w, lucyLight, 0, lucyZ + 4, 9)
    lucyLight.target.position.copy(w.world(0, lucyZ, 2))
    w.group.parent?.add(lucyLight.target)
    // animated chrome horse + a flock of glass flamingos crossing the vault
    for (const [file, lx, lz, size, mat] of [
      ['Horse.glb', -6.5, lucyZ + 1.5, 3.2, new THREE.MeshPhysicalMaterial({ color: '#c9c2e8', metalness: 1, roughness: 0.12, clearcoat: 1 })],
      ['Flamingo.glb', 6.5, lucyZ + 1.5, 2.6, new THREE.MeshPhysicalMaterial({ color: '#ffb8ee', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.85, emissive: '#3a0b33' })],
    ] as const) {
      plinth(lx, lz, 1.3)
      later(() =>
        loadGLB(file).then((gl) => {
          const o = gl.scene.clone()
          o.traverse((m: any) => m.isMesh && (m.material = mat))
          fit(o, size)
          const holder = new THREE.Group()
          holder.add(o)
          local(w, holder, lx, lz, 0.9)
          turn.push(holder)
          const mx = new THREE.AnimationMixer(o)
          if (gl.animations[0]) mx.clipAction(gl.animations[0]).play()
          mixers.push(mx)
        }),
      )
    }
    const flock: THREE.Object3D[] = []
    later(() =>
      loadGLB('Flamingo.glb').then((gl) => {
        for (let i = 0; i < 5; i++) {
          const o = gl.scene.clone()
          o.traverse((m: any) => m.isMesh && (m.material = M.neonSoft))
          fit(o, 1.4)
          const holder = new THREE.Group()
          holder.add(o)
          w.group.add(holder)
          holder.userData.phase = i * 1.25
          flock.push(holder)
          const mx = new THREE.AnimationMixer(o)
          if (gl.animations[0]) mx.clipAction(gl.animations[0]).setDuration(0.9 + i * 0.1).play()
          mixers.push(mx)
        }
      }),
      1500,
    )
    const pulse = motes(w, '#d9ccff', 380, [w.W - 2, 10, w.L], 0.15, 0.06)
    return {
      tick: (dt, tm, here) => {
        if (here === 'escultura' || here === 'lobby') ticks.forEach((f) => f(tm))
        if (here !== 'escultura') return
        mixers.forEach((m) => m.update(dt))
        turn.forEach((o, i) => (o.rotation.y = tm * 0.18 + i))
        flock.forEach((o) => {
          const a = tm * 0.25 + o.userData.phase
          o.position.set(Math.cos(a) * 5, w.floorY + 7.5 + Math.sin(a * 2) * 0.6, z0 - w.L / 2 + Math.sin(a) * 6)
          o.rotation.y = -a
        })
        pulse(tm)
        lucyLight.intensity = 140 + Math.sin(tm * 0.8) * 30
      },
    }
  },
  videosala(w, c, add, hooks) {
    const cv = document.createElement('canvas')
    cv.width = 640
    cv.height = 360
    const g = cv.getContext('2d')!
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 8.55), screenMat)
    local(w, screen, 0, z0 - w.L + 1.2, 1.4 + 3.9)
    const frame = archOutline(16, 10.2, 0.03)
    local(w, frame, 0, z0 - w.L + 1.1, 0.9)
    const velvet = P.velvet.clone() as THREE.MeshPhysicalMaterial
    velvet.color.set('#641b31')
    velvet.roughness = 0.92
    velvet.sheen = 0.9
    velvet.sheenColor.set('#a34562')
    const seatGeo = new THREE.BoxGeometry(0.78, 0.22, 0.7)
    const backGeo = new THREE.BoxGeometry(0.78, 0.95, 0.16)
    const armGeo = new THREE.BoxGeometry(0.08, 0.5, 0.72)
    const rows = 5
    const per = 10
    const seats = new THREE.InstancedMesh(seatGeo, velvet, rows * per)
    const backs = new THREE.InstancedMesh(backGeo, velvet, rows * per)
    const arms = new THREE.InstancedMesh(armGeo, gold(), rows * per * 2)
    const mtx = new THREE.Matrix4()
    let n = 0
    let armCount = 0
    for (let r = 0; r < rows; r++) {
      const lz = z0 - 4.5 - r * 2.1
      const rise = (rows - 1 - r) * 0.32
      const tier = new THREE.Mesh(new THREE.BoxGeometry(w.W - 2, 0.32, 2.1), M.obsidian)
      if (rise > 0) (local(w, tier, 0, lz, rise - 0.16), w.rect(0, lz, (w.W - 2) / 2, 1.05, w.floorY + rise, w.floorY + rise, true))
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(w.W - 2.4, 1.86), velvet)
      carpet.rotation.x = -Math.PI / 2
      local(w, carpet, 0, lz, rise + 0.015)
      const step = new THREE.Mesh(new THREE.BoxGeometry(w.W - 2, 0.025, 0.03), M.neonSoft)
      local(w, step, 0, lz + 1.05, rise + 0.01)
      for (let k = 0; k < per; k++) {
        if (k === 4 || k === 5) continue
        const lx = (k - 4.5) * 1.15
        mtx.makeTranslation(lx, w.floorY + rise + 0.45, lz)
        seats.setMatrixAt(n, mtx)
        mtx.makeTranslation(lx, w.floorY + rise + 0.85, lz + 0.32)
        backs.setMatrixAt(n, mtx)
        mtx.makeTranslation(lx - 0.43, w.floorY + rise + 0.5, lz)
        arms.setMatrixAt(armCount++, mtx)
        mtx.makeTranslation(lx + 0.43, w.floorY + rise + 0.5, lz)
        arms.setMatrixAt(armCount++, mtx)
        n++
        w.obstacle(lx, lz, 0.5)
      }
      const eye = w.world(-1.15 * 0.5 - 1.15, lz - 0.05, rise + 1.15)
      const look = w.world(0, z0 - w.L + 1.2, 4.6)
      add({ id: 'seat' + r, pos: w.world(0, lz), r: 1, label: L('Sentarse en la butaca', 'Take a seat'), room: w.room, action: () => hooks.sit(eye, look) })
    }
    seats.count = backs.count = n
    arms.count = armCount
    for (const im of [seats, backs, arms]) local(w, im, 0, 0, 0)
    for (const im of [seats, backs, arms]) (im.position.set(0, 0, 0), (im.rotation.y = 0))
    // velvet curtains and gilded proscenium
    for (const sd of [-1, 1]) {
      const cg = new THREE.PlaneGeometry(2.6, 10, 26, 1)
      const pa = cg.attributes.position
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 7) * 0.18)
      cg.computeVertexNormals()
      const cur = new THREE.Mesh(cg, velvet)
      local(w, cur, sd * 8.4, z0 - w.L + 1.6, 5)
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 10, 16), gold())
      local(w, col, sd * 7.3, z0 - w.L + 1.4, 5)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.35, 0.3), gold())
    local(w, lintel, 0, z0 - w.L + 1.3, 9.9)
    for (const f of [0.3, 0.6]) {
      const ch = chandelier(2, 22)
      local(w, ch, 0, z0 - w.L * f, 8.6)
    }
    for (const sd of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const sconce = new THREE.PointLight('#ffb68a', 3, 4, 2)
        local(w, sconce, sd * (w.W / 2 - 0.4), z0 - 3 - i * 4.5, 3)
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), M.neonWhite)
        local(w, flame, sd * (w.W / 2 - 0.35), z0 - 3 - i * 4.5, 3)
      }
    const l = new THREE.PointLight('#8f7bff', 25, 0, 1.6)
    local(w, l, 0, z0 - w.L + 5, 4)
    let film = 0
    let video: HTMLVideoElement | null = null
    let videoTex: THREE.VideoTexture | null = null
    const setFilm = (i: number) => {
      film = (i + c.films.length) % Math.max(1, c.films.length)
      const f = c.films[film]
      video?.pause()
      video = null
      screenMat.map = tex
      screenMat.needsUpdate = true
      if (f?.media) {
        import('../core/media').then(({ resolveMedia }) =>
          resolveMedia(f.media).then((url) => {
            if (!url) return
            const v = document.createElement('video')
            v.src = url
            v.loop = true
            v.muted = true
            v.playsInline = true
            v.play().catch(() => {})
            video = v
            videoTex = new THREE.VideoTexture(v)
            videoTex.colorSpace = THREE.SRGBColorSpace
            screenMat.map = videoTex
            screenMat.needsUpdate = true
          }),
        )
      }
    }
    setFilm(0)
    hooks.nextFilm = () => setFilm(film + 1)
    add({ id: 'film', pos: w.world(0, z0 - 2.6), r: 1.8, label: L('Cartelera · elegir proyección', 'Catalog · choose a screening'), room: w.room, action: () => hooks.openCatalog(setFilm) })
    let acc = 0
    return {
      tick: (dt, t, here) => {
        if (here !== 'videosala' && here !== 'lobby') return
        if (here === 'videosala') l.intensity = 18 + Math.sin(t * 7) * 3 + Math.sin(t * 13) * 2
        if (video) return
        acc += dt
        if (acc < 1 / 24) return
        acc = 0
        drawFilm(g, c.films[film]?.gen ?? 'nebula', t, (c.films[film] ? tx(c.films[film], 'title') : ''))
        tex.needsUpdate = true
      },
    }
  },
  tienda(w, c, add, hooks) {
    roomLight(w, '#e2d4ff', 20)
    const decor = shopDecor(w, c)
    shopTicks.push(decor.tick)
    const list = c.products
    list.forEach((p, i) => {
      const side = i % 2 ? 1 : -1
      const j = Math.floor(i / 2)
      const per = Math.ceil(list.length / 2)
      const lz = z0 - 3 - ((j + 0.5) / per) * (w.L - 6)
      const lx = side * (w.W / 2 - 2.4)
      const g = new THREE.Group()
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.4), P.wood)
      ped.position.y = 0.35
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.025, 1.44), P.gold)
      trim.position.y = 0.72
      const glassMat = new THREE.MeshPhysicalMaterial({ color: '#d8d0ff', transparent: true, opacity: 0.055, roughness: 0.16, metalness: 0.04, depthWrite: false, side: THREE.DoubleSide })
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.38, 1.3), glassMat)
      glass.position.y = 1.42
      const rimMat = P.gold
      const rim = new THREE.Group()
      for (const x of [-0.64, 0.64]) for (const z of [-0.64, 0.64]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.36, 0.025), rimMat)
        post.position.set(x, 1.42, z)
        rim.add(post)
      }
      for (const y of [0.73, 2.11]) {
        for (const z of [-0.64, 0.64]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.025, 0.025), rimMat)
          bar.position.set(0, y, z)
          rim.add(bar)
        }
        for (const x of [-0.64, 0.64]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1.3), rimMat)
          bar.position.set(x, y, 0)
          rim.add(bar)
        }
      }
      const img = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02), textureFor(p.gen, p.seed, p.media, 'image'))
      img.position.set(0, 1.48, 0.46)
      img.userData.spin = true
      const downlight = new THREE.PointLight('#e4d8ff', 0.4, 2.8, 2)
      downlight.position.set(0, 2.03, 0)
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.025), M.obsidian)
      plaque.position.set(0, 0.88, 0.6)
      const price = label(tx(p, 'name'), `$${p.price}`, 0.78, '#ead9b6')
      price.position.set(0, 0.88, 0.62)
      g.add(ped, trim, glass, rim, img, downlight, plaque, price)
      local(w, g, lx, lz)
      w.obstacle(lx, lz, 1.05)
      add({ id: p.id, pos: w.world(lx - side * 1.6, lz), r: 1.7, label: `${tx(p, 'name')} · $${p.price}`, room: w.room, action: () => hooks.openShop(p) })
    })
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.2), P.wood)
    local(w, counter, 0, z0 - w.L + 2.5, 0.55)
    const cl = new THREE.Mesh(new THREE.BoxGeometry(5, 0.025, 0.025), P.gold)
    local(w, cl, 0, z0 - w.L + 3.1, 1.1)
    w.obstacle(-1.6, z0 - w.L + 2.5, 1)
    w.obstacle(0, z0 - w.L + 2.5, 1)
    w.obstacle(1.6, z0 - w.L + 2.5, 1)
    add({ id: 'shop', pos: w.world(0, z0 - w.L + 4.4), r: 2.2, label: L('Abrir tienda', 'Open shop'), room: w.room, action: () => hooks.openShop() })
    const t = label(tx(c.rooms.tienda, 'name'), tx(c.rooms.tienda, 'subtitle'), 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    // garment rail with print-on-demand tees in the museum palette
    const tee = new THREE.Shape()
    tee.moveTo(-0.32, 0).lineTo(0.32, 0).lineTo(0.32, 0.5).lineTo(0.5, 0.42).lineTo(0.58, 0.6).lineTo(0.24, 0.8).quadraticCurveTo(0, 0.7, -0.24, 0.8).lineTo(-0.58, 0.6).lineTo(-0.5, 0.42).lineTo(-0.32, 0.5).lineTo(-0.32, 0)
    const teeGeo = new THREE.ExtrudeGeometry(tee, { depth: 0.04, bevelEnabled: false })
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 8), gold())
    rail.rotation.z = Math.PI / 2
    local(w, rail, 0, z0 - w.L / 2, 2.6)
    for (const sx of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), gold())
      local(w, post, sx, z0 - w.L / 2, 1.3)
    }
    const teeCols = ['#0b0a12', '#1a1233', '#ece8ff', '#2a1d4a', '#0b0a12', '#b89cff', '#16131f']
    teeCols.forEach((col, i) => {
      const m = new THREE.Mesh(teeGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }))
      const print = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), textureFor(['rose', 'nebula', 'portal', 'glyph', 'eclipse', 'flower', 'choir'][i], 300 + i, undefined, 'image'))
      print.position.set(0, 0.42, 0.045)
      const g = new THREE.Group()
      g.add(m, print)
      g.userData.sway = i
      local(w, g, -2.6 + i * 0.86, z0 - w.L / 2, 1.7, 0)
    })
    w.obstacle(0, z0 - w.L / 2, 1)
    w.obstacle(-2, z0 - w.L / 2, 1)
    w.obstacle(2, z0 - w.L / 2, 1)
    // holographic sticker wall
    const stickers = new THREE.Group()
    const srng = mulberry32(77)
    for (let i = 0; i < 36; i++) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.22 + srng() * 0.12, i % 3 ? 24 : 4), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setHSL(0.7 + srng() * 0.25, 0.8, 0.65), iridescence: 1, metalness: 0.6, roughness: 0.2, emissive: new THREE.Color().setHSL(0.75, 0.8, 0.15) }))
      sh.position.set((i % 9) * 0.6 - 2.4, Math.floor(i / 9) * 0.6, 0)
      sh.rotation.z = srng() * 3
      stickers.add(sh)
    }
    local(w, stickers, 0, z0 - w.L + 0.6, 3.8)
    const spinners: THREE.Object3D[] = []
    w.group.traverse((o) => o.userData.spin && spinners.push(o))
    return {
      tick: (_dt, t, here) => {
        if (here !== 'tienda') return
        spinners.forEach((o, i) => (o.rotation.y = t * 0.6 + i))
        w.group.children.forEach((o) => o.userData.sway !== undefined && (o.rotation.y = Math.sin(t * 0.8 + o.userData.sway) * 0.25))
        stickers.children.forEach((o, i) => (o.rotation.z += Math.sin(t + i) * 0.002))
      },
    }
  },
  videojuegos(w, c, add, hooks) {
    roomLight(w, '#9fb4ff', 50)
    const doors = c.games
    const per = Math.ceil(doors.length / 2)
    doors.forEach((d, i) => {
      const side = i % 2 ? 1 : -1
      const j = Math.floor(i / 2)
      const lz = z0 - 4 - ((j + 0.5) / per) * (w.L - 8)
      const lx = side * (w.W / 2 - 0.45)
      const g = new THREE.Group()
      const arch = archOutline(2.6, 4.4, 0.08)
      const portal = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 4.3),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(d.open ? '#8b6cff' : '#2a2440').multiplyScalar(d.open ? 1.4 : 1), transparent: true, opacity: d.open ? 0.55 : 0.85, toneMapped: false }),
      )
      portal.position.y = 2.15
      portal.userData.portal = d.open
      const l = label(tx(d, 'title'), d.open ? L('entrar', 'enter') : L('próximamente', 'coming soon'), 3.2)
      l.position.y = 5.2
      g.add(arch, portal, l)
      local(w, g, lx, lz, 0, side * -Math.PI / 2)
      if (d.open || d.kind === 'url') add({ id: d.id, pos: w.world(lx - side * 1.6, lz), r: 1.8, label: d.open ? `${L('Entrar', 'Enter')} · ${tx(d, 'title')}` : `${d.title} · próximamente`, room: w.room, action: () => hooks.openGame(d) })
    })
    for (let i = 0; i < 5; i++) {
      const lz = z0 - 2 - i * ((w.L - 4) / 4)
      for (const s of [-1, 1]) {
        const cd = candelabra()
        local(w, cd, s * (w.W / 2 - 1.4), lz)
        w.obstacle(s * (w.W / 2 - 1.4), lz, 0.45)
      }
    }
    const t = label(tx(c.rooms.videojuegos, 'name'), tx(c.rooms.videojuegos, 'subtitle'), 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    const portals: THREE.Mesh[] = []
    w.group.traverse((o) => o.userData.portal && portals.push(o as THREE.Mesh))
    // multiverse: floating worlds of different physics drifting down the hall
    const worlds: THREE.Object3D[] = []
    const rng = mulberry32(4040)
    const kinds = [
      () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: '#7cf7ff', emissive: '#0d5d75', flatShading: true, metalness: 0.4, roughness: 0.3 })),
      () => new THREE.Mesh(new THREE.TorusKnotGeometry(0.45, 0.14, 96, 10), new THREE.MeshStandardMaterial({ color: '#ff9be9', emissive: '#55114a', metalness: 0.9, roughness: 0.2 })),
      () => new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#7a3d00', emissiveIntensity: 0.8, roughness: 0.6 })),
      () => new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: '#9fb4ff', emissive: '#1b2a7a', wireframe: true })),
    ]
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group()
      const core = kinds[i % kinds.length]()
      g.add(core)
      const ring = halo(1 + rng() * 0.4, i % 2 ? M.neon : M.neonSoft, 0.015)
      ring.rotation.x = 1 + rng()
      g.add(ring)
      g.userData = { lx: (rng() - 0.5) * (w.W - 4), lz: z0 - 2 - rng() * (w.L - 4), y: 3.5 + rng() * 4, ph: rng() * 6, s: 0.5 + rng() * 0.8 }
      g.scale.setScalar(g.userData.s)
      w.group.add(g)
      worlds.push(g)
    }
    // starfield tunnel overhead
    const tunnel = motes(w, '#9fdcff', 900, [w.W - 1, 10, w.L], 0.9, 0.06)
    return {
      tick: (_dt, t, here) => {
        portals.forEach((p, i) => ((p.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2 + i) * 0.2))
        if (here !== 'videojuegos') return
        tunnel(t)
        for (const g of worlds) {
          const u = g.userData
          g.position.copy(w.world(u.lx + Math.sin(t * 0.2 + u.ph) * 0.8, u.lz + Math.cos(t * 0.15 + u.ph) * 0.8, w.floorY + u.y + Math.sin(t * 0.7 + u.ph) * 0.4))
          g.children[0].rotation.set(t * 0.4 + u.ph, t * 0.6, 0)
          g.children[1].rotation.z = t * 0.8
        }
      },
    }
  },
  futuro(w, c, add, hooks) {
    if (!w.open) return { tick: () => {} }
    const rng = mulberry32(c.settings.seed)
    const kind = c.settings.futureKind
    const spin: THREE.Object3D[] = []
    roomLight(w, '#b8a2ff', 50)
    if (kind === 'mirador') {
      const centerZ = z0 - w.L / 2
      const radius = Math.min(w.W * 0.46, w.H * 0.62)
      const domeMat = new THREE.MeshPhysicalMaterial({ color: '#211a32', metalness: 0.22, roughness: 0.48, side: THREE.DoubleSide })
      for (const geo of [
        new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI - 0.32, 0, Math.PI / 2),
        new THREE.SphereGeometry(radius, 32, 16, Math.PI + 0.32, Math.PI - 0.32, 0, Math.PI / 2),
      ]) local(w, new THREE.Mesh(geo, domeMat), 0, centerZ, 3.1)
      const slit = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.995, 16, 16, Math.PI - 0.32, 0.64, 0, Math.PI / 2), galaxyWindowMat())
      local(w, slit, 0, centerZ, 3.1)
      for (const phi of [Math.PI - 0.32, Math.PI + 0.32]) {
        const points: THREE.Vector3[] = []
        for (let i = 0; i <= 24; i++) {
          const theta = (i / 24) * Math.PI / 2
          points.push(new THREE.Vector3(radius * Math.sin(theta) * Math.cos(phi), radius * Math.cos(theta), radius * Math.sin(theta) * Math.sin(phi)))
        }
        const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.028, 5), P.gold)
        local(w, edge, 0, centerZ, 3.1)
      }
      const chart = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.035, 8, 96), gold())
      chart.rotation.x = Math.PI / 2
      local(w, chart, 0, centerZ, 0.07)
      const innerChart = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.018, 6, 96), M.neonSoft)
      innerChart.rotation.x = Math.PI / 2
      local(w, innerChart, 0, centerZ, 0.08)
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        const star = new THREE.Mesh(new THREE.SphereGeometry(i % 3 ? 0.045 : 0.075, 6, 6), gold())
        local(w, star, Math.cos(a) * 3.25, centerZ + Math.sin(a) * 3.25, 0.13)
      }
      const telescope = new THREE.Group()
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 1.8, 12), P.gold)
      pier.position.y = 0.9
      telescope.add(pier)
      const up = new THREE.Vector3(0, 1, 0)
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2
        const foot = new THREE.Vector3(Math.cos(angle) * 0.82, 0.08, Math.sin(angle) * 0.82)
        const top = new THREE.Vector3(0, 1.2, 0)
        const direction = top.clone().sub(foot)
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, direction.length(), 8), P.gold)
        leg.position.copy(foot).add(top).multiplyScalar(0.5)
        leg.quaternion.setFromUnitVectors(up, direction.normalize())
        telescope.add(leg)
      }
      const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.22, 12), P.gold)
      saddle.position.y = 1.82
      const axis = new THREE.Vector3(-0.72, 0.68, -0.12).normalize()
      const axisRotation = new THREE.Quaternion().setFromUnitVectors(up, axis)
      const pivot = new THREE.Vector3(0, 2.28, 0)
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), P.gold)
      joint.position.copy(pivot)
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.7, 16), P.gold)
      tube.position.copy(pivot).addScaledVector(axis, 1.35)
      tube.quaternion.copy(axisRotation)
      const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 12), P.gold)
      eyepiece.position.copy(pivot).addScaledVector(axis, 0.16)
      eyepiece.quaternion.copy(axisRotation)
      const forkSide = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 0, 1)).normalize()
      const fork: THREE.Mesh[] = []
      for (const sign of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.45, 8), P.gold)
        arm.position.copy(pivot).addScaledVector(axis, 0.7).addScaledVector(forkSide, sign * 0.34)
        arm.quaternion.copy(axisRotation)
        fork.push(arm)
      }
      telescope.add(saddle, joint, tube, eyepiece, ...fork)
      local(w, telescope, -1.6, centerZ + 0.6)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const col = column(3.5, 0.22)
        const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.18, 12), P.gold)
        capital.position.y = 3.56
        col.add(capital)
        local(w, col, Math.cos(a) * (radius - 0.5), centerZ + Math.sin(a) * (radius - 0.5))
      }
      const starfield = new THREE.Mesh(new THREE.PlaneGeometry(w.W - 2, w.H - 2), galaxyWindowMat())
      local(w, starfield, 0, centerZ - w.L * 0.34, 6.5, Math.PI)
    } else if (kind === 'santuario') {
      const n = 6 + Math.floor(rng() * 6)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const col = column(3 + rng() * 4, 0.3)
        const lx = Math.cos(a) * 5
        const lz = z0 - w.L / 2 + Math.sin(a) * 5
        local(w, col, lx, lz)
        w.obstacle(lx, lz, 0.6)
      }
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), M.neon)
      local(w, orb, 0, z0 - w.L / 2, 3)
      spin.push(orb)
    } else {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.neonSoft, 220)
      const m = new THREE.Matrix4()
      for (let i = 0; i < 220; i++) {
        const side = i % 2 ? 1 : -1
        m.makeTranslation(side * (w.W / 2 - 1 - rng() * 1.5), w.floorY + 0.4 + Math.floor(rng() * 12) * 0.6, z0 - 1 - rng() * (w.L - 2))
        im.setMatrixAt(i, m)
      }
      w.group.add(im)
    }
    const t = label(c.settings.futureName, `${L('semilla', 'seed')} ${c.settings.seed}`, 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    add({ id: 'future', pos: w.world(0, z0 - w.L / 2 + 4), r: 2.4, label: `${c.settings.futureName} · ${L('ver eventos', 'see events')}`, room: w.room, action: () => hooks.openEvents() })
    return { tick: (_dt, tm) => spin.forEach((o, i) => (o.rotation.y = tm * 0.2 * (i % 2 ? 1 : -1))) }
  },
  jardin(w, c, add, hooks) {
    const cz = z0 - 22
    const R = 22
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 4, 64), pbr('forrest_ground_01', { repeat: [5, 5], color: '#9aa99b', roughness: 0.94 }))
    ground.rotation.x = -Math.PI / 2
    local(w, ground, 0, cz, 0.005)
    const veinMat = new THREE.MeshBasicMaterial({ color: '#65a68d', transparent: true, opacity: 0.1, toneMapped: false })
    const veinRng = mulberry32(125)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 4, 0.02, cz + Math.sin(a) * 4),
        new THREE.Vector3(Math.cos(a + 0.3) * 10, 0.025, cz + Math.sin(a + 0.3) * 10),
        new THREE.Vector3(Math.cos(a - 0.18) * 16, 0.025, cz + Math.sin(a - 0.18) * 16),
        new THREE.Vector3(Math.cos(a + (veinRng() - 0.5)) * 23, 0.02, cz + Math.sin(a + (veinRng() - 0.5)) * 23),
      ])
      w.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.018, 5, false), veinMat))
    }
    w.rect(0, z0 - 6, 5, 7)
    w.circle(0, cz, R)
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshStandardMaterial({ color: '#0a0920', metalness: 1, roughness: 0.05 }))
    pool.rotation.x = -Math.PI / 2
    local(w, pool, 0, cz, 0.03)
    const poolRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.6, 0.012, 4, 64),
      new THREE.MeshBasicMaterial({ color: '#c9a86a', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
    )
    poolRing.rotation.x = Math.PI / 2
    local(w, poolRing, 0, cz, 0.08)
    w.obstacle(0, cz, 4.7)
    add({ id: 'garden', pos: w.world(0, cz + 6), r: 2.4, label: L('Plantar una flor (apoyar al jardín)', 'Plant a flower (support the garden)'), room: w.room, action: () => hooks.donate() })
    const rng = mulberry32(99)
    const gardenPaths = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, z0 - 2),
        new THREE.Vector3(-2.5, 0, z0 - 7),
        new THREE.Vector3(-8, 0, cz + 9),
        new THREE.Vector3(-10, 0, cz + 3),
        new THREE.Vector3(-7, 0, cz - 5),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, z0 - 2),
        new THREE.Vector3(2.5, 0, z0 - 7),
        new THREE.Vector3(8, 0, cz + 9),
        new THREE.Vector3(10, 0, cz + 3),
        new THREE.Vector3(7, 0, cz - 5),
      ]),
    ]
    const flags = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.12, 0.64), P.stoneCarved, 112)
    const flag = new THREE.Object3D()
    let flagIndex = 0
    for (const path of gardenPaths) {
      for (let i = 0; i < 56; i++) {
        const t = (i + 0.5) / 56
        const point = path.getPointAt(t)
        const tangent = path.getTangentAt(t)
        flag.position.set(point.x + (rng() - 0.5) * 0.12, w.floorY + 0.07, point.z + (rng() - 0.5) * 0.12)
        flag.rotation.set(0, Math.atan2(-tangent.z, tangent.x) + (rng() - 0.5) * 0.12, 0)
        flag.scale.set(0.78 + rng() * 0.35, 0.8 + rng() * 0.3, 0.78 + rng() * 0.35)
        flag.updateMatrix()
        flags.setMatrixAt(flagIndex++, flag.matrix)
      }
    }
    flags.instanceMatrix.needsUpdate = true
    w.group.add(flags)
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#2b2130', metalness: 0.05, roughness: 0.95 })
    const hedgeMat = new THREE.MeshStandardMaterial({ color: '#18261c', roughness: 0.95 })
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      const lx = Math.cos(a) * (R + 0.5)
      const lz = cz + Math.sin(a) * (R + 0.5)
      if (lz > cz + R - 2 && Math.abs(lx) < 6) continue
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), hedgeMat)
      local(w, post, lx, lz, 0.35)
    }
    const portal = archOutline(6, 9, 0.12)
    local(w, portal, 0, z0 - 1.05, 0, Math.PI)
    const sign = label(L('Jardín Digital', 'Digital Garden'), L('cada pago hace crecer una flor', 'every payment grows a flower'), 6)
    local(w, sign, 0, z0 - 1.2, 10.2, Math.PI)
    const gl = new THREE.PointLight('#a98bff', 40, 0, 1.4)
    local(w, gl, 0, cz, 6)
    // living hero plants (glTF, transmission + subsurface) around the reflecting pool
    const prefabs: THREE.Object3D[] = []
    const mixersG: THREE.AnimationMixer[] = []
    later(() =>
      Promise.all(['fern_02', 'shrub_03', 'potted_plant_04', 'flower_empodium', 'calathea_orbifolia_01'].map((slug) => loadGLB(`ph/${slug}/${slug}_1k.gltf`))).then((models) => {
        const sizes = [2.8, 2.7, 2.2, 1.8, 2.5]
        const prototypes = models.map((model, i) => {
          tame(model.scene)
          return fit(model.scene.clone(), sizes[i])
        })
        prefabs.push(...prototypes.map((p) => p.clone()))
        prototypes.forEach((prototype, variant) => {
          prototype.updateMatrixWorld(true)
          const placements: THREE.Matrix4[] = []
          const count = variant === 2 ? 8 : 36
          for (let i = 0; i < count; i++) {
            const cluster = i % 10
            const a = (cluster / 10) * Math.PI * 2 + (rng() - 0.5) * 0.5
            const r = 7 + rng() * 13
            let lx = Math.cos(a) * r
            let lz = cz + Math.sin(a) * r
            let scale = 0.58 + rng() * 0.68
            if (variant === 1 && i < 8) {
              lx = (i % 2 ? 1 : -1) * 4.1
              lz = z0 - 5 - Math.floor(i / 2) * 1.45
              scale = 0.42 + rng() * 0.12
            } else if (variant === 1 && i < 12) {
              const treeAngle = ((i - 8) / 4) * Math.PI * 2 + 0.4
              lx = Math.cos(treeAngle) * 17
              lz = cz + Math.sin(treeAngle) * 17
              scale = 1.7 + rng() * 0.35
            } else if (variant === 3) {
              const path = gardenPaths[i % gardenPaths.length]
              const point = path.getPointAt((i + 0.5) / count)
              const tangent = path.getTangentAt((i + 0.5) / count)
              const offset = (i % 2 ? 1 : -1) * (1.1 + rng() * 1.4)
              lx = point.x + tangent.z * offset
              lz = point.z - tangent.x * offset
              scale = 0.42 + rng() * 0.38
            }
            const placement = new THREE.Object3D()
            placement.position.set(lx, w.floorY, lz)
            placement.rotation.y = a + rng()
            placement.scale.setScalar(scale)
            placement.updateMatrix()
            placements.push(placement.matrix.clone())
            w.obstacle(lx, lz, variant === 2 ? 0.35 : 0.5)
          }
          prototype.traverse((object) => {
            const mesh = object as THREE.Mesh
            if (!mesh.isMesh) return
            const instances = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length)
            placements.forEach((placement, i) => instances.setMatrixAt(i, placement.clone().multiply(mesh.matrixWorld)))
            instances.instanceMatrix.needsUpdate = true
            w.group.add(instances)
          })
        })
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.5
          const holder = new THREE.Group()
          holder.add(prototypes[[0, 1, 3, 4, 0, 1][i]].clone())
          local(w, holder, Math.cos(a) * 6.2, cz + Math.sin(a) * 6.2)
          holder.userData.phase = i
          heroes.push(holder)
        }
        for (const pending of queued.splice(0)) addPlant(pending, false)
      }),
      900,
    )
    const heroes: THREE.Object3D[] = []
    const queued: PaymentEvent[] = []
    const fireflies = motes(w, '#d8ff9b', 420, [R * 2, 6, R * 2], 0.12, 0.09)
    const ffHolder = w.group.children[w.group.children.length - 1]
    ffHolder.position.z = cz + R
    // plants grown by payments
    const plants = new THREE.Group()
    w.group.add(plants)
    const growing: { obj: THREE.Object3D; t: number }[] = []
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.05, 1, 5)
    stemGeo.translate(0, 0.5, 0)
    const petalGeo = new THREE.SphereGeometry(0.18, 8, 6)
    petalGeo.scale(1, 0.35, 0.55)
    petalGeo.translate(0.2, 0, 0)
    const colors = ['#c9b3ff', '#8fb4ff', '#ff9be9', '#9ffff0', '#ffffff']
    const addPlant = (p: PaymentEvent, fresh: boolean) => {
      if (plants.children.length > 220) plants.remove(plants.children[0])
      const r = mulberry32(p.seed)
      let lx = 0
      let lz = 0
      for (let k = 0; k < 10; k++) {
        const a = r() * Math.PI * 2
        const rr = 5.6 + r() * (R - 8)
        lx = Math.cos(a) * rr
        lz = cz + Math.sin(a) * rr
        if (!(lz > cz + R - 7 && Math.abs(lx) < 4)) break
      }
      const scale = 0.7 + Math.min(2.2, Math.log10(1 + p.amount) * 0.7)
      const f = new THREE.Group()
      if (prefabs.length) {
        const o = prefabs[Math.floor(r() * prefabs.length)].clone()
        o.scale.multiplyScalar(0.6 + scale * 0.4)
        o.rotation.y = r() * 6.28
        f.add(o)
        const glow = new THREE.PointLight(colors[Math.floor(r() * colors.length)], 1.5, 3, 2)
        glow.position.y = 1
        f.add(glow)
        f.position.set(lx, w.floorY, lz)
        f.userData.phase = r() * 6
        plants.add(f)
        if (fresh) {
          f.scale.setScalar(0.001)
          growing.push({ obj: f, t: 0 })
        }
        return
      }
      const col = new THREE.Color(colors[Math.floor(r() * colors.length)]).multiplyScalar(1.8)
      const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false })
      const stem = new THREE.Mesh(stemGeo, trunkMat)
      stem.scale.y = 1.2 * scale
      f.add(stem)
      const head = new THREE.Group()
      head.position.y = 1.2 * scale
      const np = 5 + Math.floor(r() * 4)
      for (let k = 0; k < np; k++) {
        const pe = new THREE.Mesh(petalGeo, mat)
        pe.rotation.y = (k / np) * Math.PI * 2
        pe.rotation.z = 0.4
        head.add(pe)
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), M.neonWhite)
      head.add(core)
      head.scale.setScalar(scale)
      f.add(head)
      f.position.set(lx, w.floorY, lz)
      f.userData.phase = r() * 6
      plants.add(f)
      if (fresh) {
        f.scale.setScalar(0.001)
        growing.push({ obj: f, t: 0 })
      }
    }
    return {
      addPlant,
      tick: (dt, t, here) => {
        for (let i = growing.length - 1; i >= 0; i--) {
          const g = growing[i]
          g.t += dt * 0.6
          const e = Math.min(1, g.t)
          g.obj.scale.setScalar(1 - Math.pow(1 - e, 3) + Math.sin(e * Math.PI) * 0.2)
          if (g.t >= 1) {
            g.obj.scale.setScalar(1)
            growing.splice(i, 1)
          }
        }
        if (here !== 'jardin') return
        for (const f of plants.children) f.rotation.z = Math.sin(t * 1.2 + f.userData.phase) * 0.06
        for (const o of heroes) (o.rotation.z = Math.sin(t * 0.7 + o.userData.phase) * 0.03), o.scale.setScalar(1 + Math.sin(t * 0.9 + o.userData.phase) * 0.02)
        mixersG.forEach((m) => m.update(dt))
        fireflies(t)
      },
    }
  },
}

export function buildRoom(w: Wing, c: Content, add: (i: Interactable) => void, hooks: Hooks): RoomRuntime {
  const b = builders[w.room]
  return b ? b(w, c, add, hooks) : { tick: () => {} }
}

function drawFilm(g: CanvasRenderingContext2D, gen: string, t: number, title: string) {
  const W = 640
  const H = 360
  g.fillStyle = 'rgba(5,4,12,0.25)'
  g.fillRect(0, 0, W, H)
  g.globalCompositeOperation = 'lighter'
  if (gen === 'cathedral') {
    for (let i = 0; i < 9; i++) {
      const x = W / 2 + Math.sin(t * 0.3 + i) * 40 * i
      g.strokeStyle = `hsla(${255 + i * 6},90%,70%,0.25)`
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x - 30 - i * 8, H)
      g.quadraticCurveTo(x - 30 - i * 8, H * 0.2, x, H * 0.05 + i * 6)
      g.quadraticCurveTo(x + 30 + i * 8, H * 0.2, x + 30 + i * 8, H)
      g.stroke()
    }
  } else if (gen === 'pulse') {
    const n = 40
    for (let i = 0; i < n; i++) {
      const h = (Math.sin(t * 6 + i * 0.5) * 0.5 + 0.5) * (Math.sin(t * 1.3 + i * 0.13) * 0.5 + 0.5) * H * 0.8
      g.fillStyle = `hsla(${260 + i * 2},90%,65%,0.5)`
      g.fillRect((i / n) * W + 2, H / 2 - h / 2, W / n - 4, h)
    }
  } else if (gen === 'bloom') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.2
      const r = 60 + Math.sin(t + i) * 50
      g.fillStyle = `hsla(${280 + i * 8},90%,70%,0.12)`
      g.beginPath()
      g.ellipse(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 80, 30, a, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    for (let i = 0; i < 30; i++) {
      const a = i * 2.39996 + t * 0.15
      const r = Math.sqrt(i) * 28 + Math.sin(t + i) * 6
      const grd = g.createRadialGradient(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.6, 0, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.6, 50)
      grd.addColorStop(0, `hsla(${230 + i * 3},90%,70%,0.25)`)
      grd.addColorStop(1, 'transparent')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
    }
  }
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = 'rgba(236,232,255,0.85)'
  g.font = '14px "Roboto Mono", monospace'
  g.fillText(title.toUpperCase(), 20, H - 20)
}
