import * as THREE from 'three'

export type AvatarKind = 'oraculo' | 'centinela' | 'astral'

export const AVATARS: { id: AvatarKind; name: string; role: string; desc: string; color: string }[] = [
  { id: 'oraculo', name: 'Oráculo', role: 'Curadora de memorias', desc: 'Túnica de obsidiana y halo lavanda. Lee las obras como profecías.', color: '#c9b3ff' },
  { id: 'centinela', name: 'Centinela', role: 'Guardián de la bóveda', desc: 'Armadura greco-futurista con visor de neón. Protege el archivo eterno.', color: '#8fb4ff' },
  { id: 'astral', name: 'Astral', role: 'Espíritu viajero', desc: 'Un ser de polvo estelar que flota entre las salas y las galaxias.', color: '#ff9be9' },
]

export interface Avatar {
  group: THREE.Group
  kind: AvatarKind
  update(dt: number, speed: number, t: number): void
  setTag(name: string): void
}

const glow = (c: string, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false })

export function createAvatar(kind: AvatarKind, color?: string): Avatar {
  const info = AVATARS.find((a) => a.id === kind) ?? AVATARS[0]
  const tint = color ?? info.color
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const dark = new THREE.MeshStandardMaterial({ color: '#15121f', roughness: 0.35, metalness: 0.6 })
  const pale = new THREE.MeshStandardMaterial({ color: '#e7e1f5', roughness: 0.25, metalness: 0.3 })
  const neon = glow(tint)
  const limbs: { l: THREE.Object3D; r: THREE.Object3D; al: THREE.Object3D; ar: THREE.Object3D } = {
    l: new THREE.Group(),
    r: new THREE.Group(),
    al: new THREE.Group(),
    ar: new THREE.Group(),
  }
  const leg = (mat: THREE.Material, len = 0.8, r = 0.09) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r * 2, 4, 8), mat)
    m.position.y = -len / 2
    return m
  }
  let floatY = 0
  if (kind === 'oraculo') {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 12, 1, true), dark)
    robe.position.y = 0.75
    body.add(robe)
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.025, 4, 24), neon)
    hem.rotation.x = Math.PI / 2
    hem.position.y = 0.06
    body.add(hem)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), dark)
    torso.position.y = 1.45
    body.add(torso)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), pale)
    head.position.y = 1.85
    body.add(head)
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), dark)
    hood.position.y = 1.88
    hood.rotation.x = -0.25
    body.add(hood)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 4, 32), neon)
    halo.position.set(0, 1.95, 0.18)
    body.add(halo)
    limbs.al.position.set(-0.26, 1.6, 0)
    limbs.ar.position.set(0.26, 1.6, 0)
    limbs.al.add(leg(dark, 0.65, 0.07))
    limbs.ar.add(leg(dark, 0.65, 0.07))
    body.add(limbs.al, limbs.ar)
  } else if (kind === 'centinela') {
    limbs.l.position.set(-0.14, 0.85, 0)
    limbs.r.position.set(0.14, 0.85, 0)
    limbs.l.add(leg(dark, 0.85, 0.1))
    limbs.r.add(leg(dark, 0.85, 0.1))
    body.add(limbs.l, limbs.r)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), pale)
    torso.position.y = 1.2
    body.add(torso)
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.02), neon)
    chest.position.set(0, 1.22, 0.16)
    body.add(chest)
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.25, 8, 1, true), dark)
    skirt.position.y = 0.85
    body.add(skirt)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), pale)
    head.position.y = 1.72
    body.add(head)
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.4), neon)
    crest.position.set(0, 1.9, 0)
    body.add(crest)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.05), neon)
    visor.position.set(0, 1.74, -0.15)
    body.add(visor)
    limbs.al.position.set(-0.32, 1.45, 0)
    limbs.ar.position.set(0.32, 1.45, 0)
    limbs.al.add(leg(pale, 0.7, 0.08))
    limbs.ar.add(leg(pale, 0.7, 0.08))
    body.add(limbs.al, limbs.ar)
    const shield = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 24), neon)
    shield.position.set(-0.42, 1.15, 0)
    shield.rotation.y = Math.PI / 2
    body.add(shield)
  } else {
    floatY = 0.35
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), glow(tint, 1.6))
    core.position.y = 1.3
    body.add(core)
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: tint, wireframe: true, transparent: true, opacity: 0.5 }))
    shell.position.y = 1.3
    body.add(shell)
    const pts: number[] = []
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * Math.PI * 2
      const y = Math.random()
      const r = 0.35 * (1 - y) + 0.05
      pts.push(Math.cos(a) * r, 1.0 - y * 0.9, Math.sin(a) * r)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    body.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.03, color: new THREE.Color(tint).multiplyScalar(1.6), toneMapped: false })))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.015, 4, 40), neon)
    ring.position.y = 1.3
    ring.rotation.x = 1.2
    body.add(ring)
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), glow('#ffffff', 2.5))
    eyes.position.set(0, 1.35, -0.3)
    body.add(eyes)
    limbs.al = ring
    limbs.ar = shell
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.45, depthWrite: false }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  g.add(shadow)
  let phase = 0
  let tag: THREE.Sprite | null = null
  return {
    group: g,
    kind,
    setTag(name) {
      if (tag) g.remove(tag)
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 64
      const x = c.getContext('2d')!
      x.fillStyle = 'rgba(10,8,20,0.55)'
      x.beginPath()
      x.roundRect(8, 10, 240, 44, 22)
      x.fill()
      x.fillStyle = '#ece8ff'
      x.font = '24px "Roboto Mono", monospace'
      x.textAlign = 'center'
      x.fillText(name.slice(0, 16), 128, 41)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
      tag.scale.set(1.2, 0.3, 1)
      tag.position.y = 2.45
      tag.renderOrder = 10
      g.add(tag)
    },
    update(dt, speed, t) {
      phase += dt * (4 + speed * 1.8) * Math.min(1, speed)
      const s = Math.min(1, speed / 4)
      if (kind === 'astral') {
        body.position.y = floatY + Math.sin(t * 2) * 0.08
        limbs.al.rotation.z = t * 1.5
        limbs.ar.rotation.y = t * 0.8
        body.rotation.x = s * 0.25
        return
      }
      const sw = Math.sin(phase) * 0.7 * s
      limbs.l.rotation.x = sw
      limbs.r.rotation.x = -sw
      limbs.al.rotation.x = -sw * 0.8
      limbs.ar.rotation.x = sw * 0.8
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * s + Math.sin(t * 1.6) * 0.01
    },
  }
}
