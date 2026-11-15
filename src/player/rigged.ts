import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { loadGLB } from '../world/assets'
import type { AvatarKind } from './avatar'

/**
 * Rigged avatar pipeline. Every character is a Mixamo-compatible skinned glTF; locomotion clips
 * are shared (retargeted by bone name) so final models only need a `mixamorig` skeleton.
 * Swap a file here to drop in the definitive characters.
 */
export const RIGS: Record<AvatarKind, { file: string; height: number; present: string; additive?: boolean; float?: number; yaw?: number }> = {
  oraculo: { file: 'Michelle.glb', height: 1.72, present: 'SambaDance', yaw: Math.PI },
  centinela: { file: 'Soldier.glb', height: 1.86, present: 'agree', additive: true },
  astral: { file: 'Xbot.glb', height: 1.8, present: 'headShake', additive: true, float: 0.12 },
}

export interface Rig {
  root: THREE.Group
  update(dt: number, speed: number, t: number): void
  present(on: boolean): void
}

export const rigsEnabled = () => !new URLSearchParams(location.search).has('norig')

let lib: Promise<THREE.AnimationClip[]> | null = null
const library = () =>
  (lib ??= loadGLB('Xbot.glb').then((g) =>
    g.animations.map((c) => {
      const k = c.clone()
      k.tracks = k.tracks.filter((t) => !t.name.endsWith('.position') && !/Eye\./.test(t.name))
      return k
    }),
  ))

const astralMat = new THREE.MeshPhysicalMaterial({ color: '#cbb8ff', metalness: 0.85, roughness: 0.18, clearcoat: 1, iridescence: 1, emissive: '#7b5bff', emissiveIntensity: 1.2 })
// Temporary aesthetic skins until the definitive characters arrive.
const oracleMat = new THREE.MeshPhysicalMaterial({ color: '#3a2c5c', metalness: 0.35, roughness: 0.32, sheen: 1, sheenColor: '#c9b3ff', sheenRoughness: 0.35, iridescence: 0.6, clearcoat: 0.6, emissive: '#2a1660', emissiveIntensity: 0.35 })
const sentinelMat = new THREE.MeshPhysicalMaterial({ color: '#c9a86a', metalness: 0.95, roughness: 0.3, clearcoat: 0.8, emissive: '#2a1a08', emissiveIntensity: 0.4 })

let stars: THREE.Texture | null = null
function starMap() {
  if (stars) return stars
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#05030c'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 380; i++) {
    const r = Math.random() ** 4 * 1.8 + 0.3
    g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`
    g.beginPath()
    g.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2)
    g.fill()
  }
  stars = new THREE.CanvasTexture(c)
  stars.colorSpace = THREE.SRGBColorSpace
  return stars
}

/** Floating halo / visor / orbiting motes that give each temporary avatar its identity. */
function accessory(kind: AvatarKind, h: number) {
  const g = new THREE.Group()
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9b3ff').multiplyScalar(1.6), toneMapped: false })
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a86a', metalness: 1, roughness: 0.25, emissive: '#3a2a10', emissiveIntensity: 0.6 })
  if (kind === 'oraculo') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 48), gold)
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.005, 4, 48), neon)
    halo.add(inner)
    halo.position.set(0, h * 0.95, 0.1)
    g.add(halo)
  } else if (kind === 'centinela') {
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 4, 40), neon)
    visor.rotation.x = Math.PI / 2
    visor.position.y = h * 0.93
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.01, 4, 64), neon)
    base.rotation.x = Math.PI / 2
    base.position.y = 0.03
    g.add(visor, base)
  } else {
    const pts = new Float32Array(90 * 3)
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 0.35 + Math.random() * 0.25
      pts.set([Math.cos(a) * r, Math.random() * h, Math.sin(a) * r], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#d9ccff', size: 0.025, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })))
  }
  return g
}

function fitHeight(obj: THREE.Object3D, h: number) {
  obj.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(obj, true)
  const s = h / Math.max(1e-4, box.max.y - box.min.y)
  obj.scale.multiplyScalar(s)
  obj.updateMatrixWorld(true)
  obj.position.y -= new THREE.Box3().setFromObject(obj, true).min.y
}

export async function loadRig(kind: AvatarKind, tint?: string): Promise<Rig> {
  const def = RIGS[kind]
  const [g, clips] = await Promise.all([loadGLB(def.file), library()])
  const model = clone(g.scene)
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.frustumCulled = false
    const src = m.material as THREE.MeshStandardMaterial
    if (kind === 'astral') {
      const mat = astralMat.clone()
      mat.emissiveMap = starMap()
      if (tint) mat.emissive = new THREE.Color(tint).multiplyScalar(0.7)
      m.material = mat
    } else if (kind === 'oraculo') {
      const mat = oracleMat.clone()
      mat.map = src.map ?? null
      if (tint) mat.sheenColor = new THREE.Color(tint)
      m.material = mat
    } else {
      const mat = sentinelMat.clone()
      mat.map = src.map ?? null
      mat.normalMap = src.normalMap ?? null
      m.material = mat
    }
  })
  model.rotation.y = def.yaw ?? 0
  fitHeight(model, def.height)
  const root = new THREE.Group()
  const aura = accessory(kind, def.height)
  root.add(model, aura)
  const mixer = new THREE.AnimationMixer(model)
  const foreign = def.file !== 'Xbot.glb'
  const source = foreign ? (await loadGLB('Xbot.glb')).scene : null
  const rest = (root: THREE.Object3D) => {
    const m = new Map<string, THREE.Quaternion>()
    root.traverse((o) => (o as THREE.Bone).isBone && m.set(o.name, o.quaternion.clone()))
    return m
  }
  const restS = source ? rest(source) : null
  const restT = rest(model)
  const qa = new THREE.Quaternion()
  const qc = new THREE.Quaternion()
  // Rest-pose-corrected retarget for Mixamo skeletons: q' = restT * restS^-1 * q
  const retarget = (c: THREE.AnimationClip) => {
    if (!restS) return c
    const k = c.clone()
    for (const t of k.tracks) {
      const [bone, prop] = t.name.split('.')
      const a = restS.get(bone)
      const b = restT.get(bone)
      if (prop !== 'quaternion' || !a || !b) continue
      qc.copy(b).multiply(a.clone().invert())
      const v = t.values
      for (let i = 0; i < v.length; i += 4) {
        qa.fromArray(v, i).premultiply(qc)
        qa.toArray(v, i)
      }
    }
    return k
  }
  const find = (n: string) => {
    const own = g.animations.find((a) => a.name.toLowerCase() === n.toLowerCase())
    if (own) return own
    const shared = clips.find((a) => a.name.toLowerCase() === n.toLowerCase())
    return shared && retarget(shared)
  }
  const act = (n: string) => {
    const c = find(n)
    if (!c) return null
    const a = mixer.clipAction(c)
    a.play()
    a.setEffectiveWeight(0)
    return a
  }
  const idle = act('idle')
  const walk = act('walk')
  const run = act('run')
  let pres: THREE.AnimationAction | null = null
  const pc = find(def.present)
  if (pc) {
    const c = def.additive ? THREE.AnimationUtils.makeClipAdditive(pc.clone()) : pc
    pres = mixer.clipAction(c)
    pres.play()
    pres.setEffectiveWeight(0)
  }
  let pw = 0
  let target = 0
  return {
    root,
    present: (on) => {
      target = on ? 1 : 0
      if (on && pres) pres.time = 0
    },
    update(dt, speed, t) {
      pw += (target - pw) * Math.min(1, dt * 5)
      const a = THREE.MathUtils.clamp(speed / 1.6, 0, 1)
      const b = THREE.MathUtils.clamp((speed - 2.6) / 2.4, 0, 1)
      const base = pres && !def.additive ? 1 - pw : 1
      idle?.setEffectiveWeight((1 - a) * base)
      walk?.setEffectiveWeight(a * (1 - b) * base)
      run?.setEffectiveWeight(a * b * base)
      if (walk) walk.timeScale = THREE.MathUtils.clamp(speed / 1.9, 0.7, 1.5)
      pres?.setEffectiveWeight(pw)
      if (def.float) root.position.y = def.float + Math.sin(t * 1.8) * 0.05
      aura.rotation.y = t * (kind === 'astral' ? 0.6 : 0.25)
      mixer.update(dt)
    },
  }
}
