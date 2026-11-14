import * as THREE from 'three'
import type { Artwork, Content, GameDoor, Product, RoomId } from '../content/types'
import { mulberry32 } from '../core/util'
import type { PaymentEvent } from '../payments/bus'
import { M, label, shared } from './materials'
import { archOutline, candelabra, chandelier, column } from './gothic'
import { paintingStele, sculpture, textureFor } from './art'
import type { Interactable, Wing } from './building'

export interface Hooks {
  openArt(a: Artwork): void
  openShop(p?: Product): void
  openGame(g: GameDoor): void
  openCall(): void
  openEvents(): void
  donate(): void
  nextFilm(): void
}

export interface RoomRuntime {
  tick(dt: number, t: number, here: RoomId): void
  addPlant?(p: PaymentEvent, fresh: boolean): void
}

type Builder = (w: Wing, c: Content, add: (i: Interactable) => void, hooks: Hooks) => RoomRuntime

const z0 = -30
const local = (w: Wing, obj: THREE.Object3D, lx: number, lz: number, y = 0, ry = 0) => {
  obj.position.set(lx, y + w.floorY, lz)
  obj.rotation.y = ry
  w.group.add(obj)
}
const roomLight = (w: Wing, color = '#b89cff', intensity = 60) => {
  const l = new THREE.PointLight(color, intensity, 0, 1.6)
  local(w, l, 0, z0 - w.L / 2, 8)
}

function gallery(w: Wing, c: Content, add: (i: Interactable) => void, hooks: Hooks, list: Artwork[], start = 2) {
  const per = Math.ceil(list.length / 2)
  const span = w.L - start - 3
  list.forEach((a, i) => {
    const side = i % 2 ? 1 : -1
    const j = Math.floor(i / 2)
    const lz = z0 - start - ((j + 0.5) / per) * span
    const lx = side * (w.W / 2 - 1.4)
    const st = paintingStele(a)
    local(w, st, lx, lz, 0, side * -Math.PI / 2)
    w.obstacle(lx, lz, 1.0)
    add({ id: a.id, pos: w.world(lx - side * 1.6, lz), r: 2.2, label: `Ver · ${a.title}`, room: w.room, action: () => hooks.openArt(a) })
  })
  void c
}

const builders: Partial<Record<RoomId, Builder>> = {
  pintura(w, c, add, hooks) {
    roomLight(w)
    gallery(w, c, add, hooks, c.artworks.filter((a) => a.room === 'pintura'))
    const ch = chandelier(1.6, 12)
    local(w, ch, 0, z0 - w.L / 2, 8)
    const t = label(c.rooms.pintura.name, c.rooms.pintura.subtitle, 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    return { tick: () => {} }
  },
  temporales(w, c, add, hooks) {
    roomLight(w, '#c7a6ff')
    gallery(w, c, add, hooks, c.artworks.filter((a) => a.room === 'temporales'), 4)
    const t = label(c.temp.title, `curaduría · ${c.temp.curator}`, 7)
    local(w, t, 0, z0 - 1.2, 8.3, Math.PI)
    const t2 = label(c.temp.title, `curaduría · ${c.temp.curator}`, 7)
    local(w, t2, 0, z0 - w.L + 0.6, 8.6)
    // call-for-artists kiosk
    const k = new THREE.Group()
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.8), M.obsidian)
    slab.position.y = 0.6
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b89cff').multiplyScalar(1.3), toneMapped: false }))
    screen.position.set(0, 1.25, 0)
    screen.rotation.x = -0.5
    k.add(slab, screen)
    const kl = label(c.temp.callOpen ? 'Convocatoria' : 'Eventos', c.temp.callOpen ? c.temp.callTitle : 'agenda del museo', 3)
    kl.position.y = 2.1
    k.add(kl)
    local(w, k, 0, z0 - w.L + 3.5, 0, 0)
    w.obstacle(0, z0 - w.L + 3.5, 1)
    add({ id: 'call', pos: w.world(0, z0 - w.L + 5.4), r: 2, label: c.temp.callOpen ? 'Postular a la convocatoria' : 'Ver eventos', room: w.room, action: () => (c.temp.callOpen ? hooks.openCall() : hooks.openEvents()) })
    return { tick: () => {} }
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
      add({ id: a.id, pos: w.world(lx, lz + 1.9), r: 1.8, label: `Ver · ${a.title}`, room: w.room, action: () => hooks.openArt(a) })
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#b89cff', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }))
      local(w, spot, lx, lz, 5)
    })
    const t = label(c.rooms.escultura.name, c.rooms.escultura.subtitle, 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    return {
      tick: (_dt, tm, here) => {
        if (here === 'escultura' || here === 'lobby') ticks.forEach((f) => f(tm))
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
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(14, 7.875), screenMat)
    local(w, screen, 0, z0 - w.L + 1.2, 1.4 + 3.9)
    const frame = archOutline(15, 9.6, 0.08)
    local(w, frame, 0, z0 - w.L + 1.1, 0.9)
    const seatGeo = new THREE.BoxGeometry(0.8, 0.9, 0.8)
    const seats = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({ color: '#2a1d4a', roughness: 0.7 }), 40)
    const mtx = new THREE.Matrix4()
    let n = 0
    for (let r = 0; r < 4; r++)
      for (let s = 0; s < 10; s++) {
        if (s === 4 || s === 5) continue
        const lx = (s - 4.5) * 1.3
        const lz = z0 - 5 - r * 2.2
        mtx.makeTranslation(lx, 0.45 + w.floorY, lz)
        seats.setMatrixAt(n++, mtx)
      }
    seats.count = n
    w.group.add(seats)
    for (let r = 0; r < 4; r++) {
      const lz = z0 - 5 - r * 2.2
      for (let s = 0; s < 10; s++) {
        if (s === 4 || s === 5) continue
        w.obstacle((s - 4.5) * 1.3, lz, 0.55)
      }
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
    add({ id: 'film', pos: w.world(0, z0 - 3), r: 2.5, label: 'Cambiar proyección', room: w.room, action: () => hooks.nextFilm() })
    let acc = 0
    return {
      tick: (dt, t, here) => {
        if (here !== 'videosala' && here !== 'lobby') return
        if (video) return
        acc += dt
        if (acc < 1 / 24) return
        acc = 0
        drawFilm(g, c.films[film]?.gen ?? 'nebula', t, c.films[film]?.title ?? '')
        tex.needsUpdate = true
      },
    }
  },
  tienda(w, c, add, hooks) {
    roomLight(w, '#e2d4ff', 70)
    const list = c.products
    list.forEach((p, i) => {
      const side = i % 2 ? 1 : -1
      const j = Math.floor(i / 2)
      const per = Math.ceil(list.length / 2)
      const lz = z0 - 3 - ((j + 0.5) / per) * (w.L - 6)
      const lx = side * (w.W / 2 - 2.4)
      const g = new THREE.Group()
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), M.obsidian)
      ped.position.y = 0.5
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.3), M.glass)
      glass.position.y = 1.75
      const img = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), textureFor(p.gen, p.seed, p.media, 'image'))
      img.position.set(0, 1.75, 0)
      img.userData.spin = true
      const led = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 1.42), M.neon)
      led.position.y = 1.0
      g.add(ped, glass, img, led)
      local(w, g, lx, lz)
      w.obstacle(lx, lz, 1.05)
      add({ id: p.id, pos: w.world(lx - side * 1.6, lz), r: 1.7, label: `${p.name} · $${p.price}`, room: w.room, action: () => hooks.openShop(p) })
    })
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.2), M.obsidian)
    local(w, counter, 0, z0 - w.L + 2.5, 0.55)
    const cl = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 0.04), M.neon)
    local(w, cl, 0, z0 - w.L + 3.1, 1.1)
    w.obstacle(-1.6, z0 - w.L + 2.5, 1)
    w.obstacle(0, z0 - w.L + 2.5, 1)
    w.obstacle(1.6, z0 - w.L + 2.5, 1)
    add({ id: 'shop', pos: w.world(0, z0 - w.L + 4.4), r: 2.2, label: 'Abrir tienda', room: w.room, action: () => hooks.openShop() })
    const t = label(c.rooms.tienda.name, c.rooms.tienda.subtitle, 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    const spinners: THREE.Object3D[] = []
    w.group.traverse((o) => o.userData.spin && spinners.push(o))
    return {
      tick: (_dt, t, here) => {
        if (here !== 'tienda') return
        spinners.forEach((o, i) => (o.rotation.y = t * 0.6 + i))
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
      const l = label(d.title, d.open ? 'entrar' : 'próximamente', 3.2)
      l.position.y = 5.2
      g.add(arch, portal, l)
      local(w, g, lx, lz, 0, side * -Math.PI / 2)
      if (d.open || d.kind === 'url') add({ id: d.id, pos: w.world(lx - side * 1.6, lz), r: 1.8, label: d.open ? `Entrar · ${d.title}` : `${d.title} · próximamente`, room: w.room, action: () => hooks.openGame(d) })
    })
    for (let i = 0; i < 5; i++) {
      const lz = z0 - 2 - i * ((w.L - 4) / 4)
      for (const s of [-1, 1]) {
        const cd = candelabra()
        local(w, cd, s * (w.W / 2 - 1.4), lz)
        w.obstacle(s * (w.W / 2 - 1.4), lz, 0.45)
      }
    }
    const t = label(c.rooms.videojuegos.name, c.rooms.videojuegos.subtitle, 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    const portals: THREE.Mesh[] = []
    w.group.traverse((o) => o.userData.portal && portals.push(o as THREE.Mesh))
    return {
      tick: (_dt, t) => portals.forEach((p, i) => ((p.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2 + i) * 0.2)),
    }
  },
  futuro(w, c, add, hooks) {
    if (!w.open) return { tick: () => {} }
    const rng = mulberry32(c.settings.seed)
    const kind = c.settings.futureKind
    const spin: THREE.Object3D[] = []
    roomLight(w, '#b8a2ff', 50)
    if (kind === 'mirador') {
      for (let i = 0; i < 7; i++) {
        const r = 0.6 + rng() * 1.2
        const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.6, 0.3, 6), M.stoneLight)
        const lx = (rng() - 0.5) * (w.W - 4)
        const lz = z0 - 3 - rng() * (w.L - 6)
        local(w, p, lx, lz, 1 + rng() * 5)
        spin.push(p)
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.08, 6, 64), M.neon)
      local(w, ring, 0, z0 - w.L / 2, 5)
      spin.push(ring)
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
    const t = label(c.settings.futureName, `semilla ${c.settings.seed}`, 6)
    local(w, t, 0, z0 - w.L + 0.6, 8.6)
    add({ id: 'future', pos: w.world(0, z0 - w.L / 2 + 4), r: 2.4, label: `${c.settings.futureName} · ver eventos`, room: w.room, action: () => hooks.openEvents() })
    return { tick: (_dt, tm) => spin.forEach((o, i) => ((o.rotation.y = tm * 0.2 * (i % 2 ? 1 : -1)), (o.position.y += Math.sin(tm + i) * 0.002))) }
  },
  jardin(w, c, add, hooks) {
    const cz = -52
    const R = 22
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(R + 4, 64),
      new THREE.ShaderMaterial({
        uniforms: { uTime: shared.time, uEnergy: shared.energy, uC: { value: new THREE.Vector2(0, cz) } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `varying vec3 vW; uniform float uTime; uniform float uEnergy;
          void main(){ vec2 p = vW.xz; float g = abs(fract(p.x*0.5)-0.5) < 0.02 || abs(fract(p.y*0.5)-0.5) < 0.02 ? 1.0 : 0.0;
            float n = sin(p.x*1.7+uTime*0.3)*sin(p.y*1.3-uTime*0.2);
            vec3 col = vec3(0.02,0.03,0.06) + vec3(0.05,0.12,0.18)*(0.5+0.5*n);
            col += vec3(0.55,0.45,1.0)*g*0.12*(1.0+uEnergy*2.0);
            gl_FragColor = vec4(col,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    local(w, ground, 0, cz, 0.005)
    w.rect(0, -36, 5, 7)
    w.circle(0, cz, R)
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshStandardMaterial({ color: '#0a0920', metalness: 1, roughness: 0.05 }))
    pool.rotation.x = -Math.PI / 2
    local(w, pool, 0, cz, 0.03)
    const poolRing = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.08, 6, 64), M.neon)
    poolRing.rotation.x = Math.PI / 2
    local(w, poolRing, 0, cz, 0.08)
    w.obstacle(0, cz, 4.7)
    add({ id: 'garden', pos: w.world(0, cz + 6), r: 2.4, label: 'Plantar una flor (apoyar al jardín)', room: w.room, action: () => hooks.donate() })
    // crystal trees
    const rng = mulberry32(99)
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#3b2f66', metalness: 0.6, roughness: 0.3 })
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3
      const r = R - 3 - rng() * 2
      const lx = Math.cos(a) * r
      const lz = cz + Math.sin(a) * r
      if (lz > cz + R - 6 && Math.abs(lx) < 6) continue
      const tree = new THREE.Group()
      const h = 3 + rng() * 2
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, h, 6), trunkMat)
      trunk.position.y = h / 2
      tree.add(trunk)
      for (let j = 0; j < 7; j++) {
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + rng() * 0.6), j % 2 ? M.neonSoft : M.glass)
        cr.position.set((rng() - 0.5) * 2, h + (rng() - 0.3) * 1.5, (rng() - 0.5) * 2)
        cr.rotation.set(rng() * 3, rng() * 3, 0)
        tree.add(cr)
      }
      local(w, tree, lx, lz)
      w.obstacle(lx, lz, 0.6)
    }
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      const lx = Math.cos(a) * (R + 0.5)
      const lz = cz + Math.sin(a) * (R + 0.5)
      if (lz > cz + R - 2 && Math.abs(lx) < 6) continue
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 5), M.obsidian)
      local(w, post, lx, lz, 0.55)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), M.neon)
      local(w, tip, lx, lz, 1.15)
    }
    // facade towers at the main portal
    for (const s of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(3, 22, 3), M.stone)
      local(w, tw, s * 5.5, -31, 11)
      const sp = new THREE.Mesh(new THREE.ConeGeometry(2.2, 10, 8), M.stone)
      local(w, sp, s * 5.5, -31, 27)
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), M.neon)
      local(w, tip, s * 5.5, -31, 32.5)
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 20, 0.06), M.neon)
      local(w, led, s * 5.5 - s * 1.52, -32.52, 11)
    }
    const portal = archOutline(6, 9, 0.12)
    local(w, portal, 0, -30.2, 0, Math.PI)
    const sign = label('Jardín Digital', 'cada pago hace crecer una flor', 6)
    local(w, sign, 0, -31.6, 10, Math.PI)
    const gl = new THREE.PointLight('#a98bff', 40, 0, 1.4)
    local(w, gl, 0, cz, 6)
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
        if (here === 'jardin') for (const f of plants.children) f.rotation.z = Math.sin(t * 1.2 + f.userData.phase) * 0.06
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
