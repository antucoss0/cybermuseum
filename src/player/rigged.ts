import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { loadGLB } from '../world/assets'
import type { AvatarKind } from './avatar'

/**
 * Rigged avatar pipeline. Every character is a Mixamo-compatible skinned glTF; locomotion clips
 * are shared (retargeted by bone name) so final models only need a `mixamorig` skeleton.
 * Swap a file here to drop in the definitive characters.
 */
export const RIGS: Record<AvatarKind, { file: string; height: number; present: string; additive?: boolean; float?: number }> = {
  oraculo: { file: 'Michelle.glb', height: 1.72, present: 'SambaDance' },
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
      k.tracks = k.tracks.filter((t) => !t.name.endsWith('.position'))
      return k
    }),
  ))

const astralMat = new THREE.MeshPhysicalMaterial({ color: '#cbb8ff', metalness: 0.85, roughness: 0.18, clearcoat: 1, iridescence: 1, emissive: '#5b3bb8', emissiveIntensity: 0.55 })

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
    if (kind === 'astral') {
      const mat = astralMat.clone()
      if (tint) mat.emissive = new THREE.Color(tint).multiplyScalar(0.5)
      m.material = mat
    }
  })
  model.rotation.y = Math.PI
  fitHeight(model, def.height)
  const root = new THREE.Group()
  root.add(model)
  const mixer = new THREE.AnimationMixer(model)
  const foreign = def.file !== 'Xbot.glb'
  const retarget = (c: THREE.AnimationClip) => {
    if (!foreign) return c
    const k = c.clone()
    k.tracks = k.tracks.filter((t) => !t.name.startsWith('mixamorigHips.'))
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
      mixer.update(dt)
    },
  }
}
