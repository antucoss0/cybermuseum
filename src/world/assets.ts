import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

const gltf = new GLTFLoader()
const ply = new PLYLoader()
const cache = new Map<string, Promise<any>>()
const base = (import.meta as any).env?.BASE_URL ?? './'

export const modelUrl = (file: string) => (/^(https?:|blob:|data:)/.test(file) ? file : base + 'models/' + file)

export function loadGLB(file: string): Promise<GLTF> {
  if (!cache.has(file)) cache.set(file, gltf.loadAsync(modelUrl(file)))
  return cache.get(file)!
}

export function loadPLY(file: string): Promise<THREE.BufferGeometry> {
  if (!cache.has(file))
    cache.set(
      file,
      ply.loadAsync(modelUrl(file)).then((g) => {
        g.computeVertexNormals()
        return g
      }),
    )
  return cache.get(file)!
}

/** Scales an object so its largest dimension equals `size` and rests its base on y=0. */
export function fit(obj: THREE.Object3D, size: number) {
  const box = new THREE.Box3().setFromObject(obj)
  const dim = box.getSize(new THREE.Vector3())
  const s = size / Math.max(dim.x, dim.y, dim.z, 1e-6)
  obj.scale.multiplyScalar(s)
  const b2 = new THREE.Box3().setFromObject(obj)
  const c = b2.getCenter(new THREE.Vector3())
  obj.position.x -= c.x
  obj.position.z -= c.z
  obj.position.y -= b2.min.y
  return obj
}

/** Idle helper: run when the browser is free so heavy models never block the first frame. */
export const later = (fn: () => void, ms = 600) =>
  setTimeout(() => {
    const w = window as any
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 1500 })
    else fn()
  }, ms)

/** Real-time transmission doubles the render cost; fake it with alpha so phones stay fluid. */
export function tame(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined
    if (!m || !(o as THREE.Mesh).isMesh) return
    if (m.transmission > 0) {
      m.transmission = 0
      m.transparent = true
      m.opacity = Math.min(m.opacity, 0.55)
      m.depthWrite = false
    }
    if ((o as any).isLight) o.visible = false
  })
  obj.traverse((o) => (o as any).isLight && (o.visible = false))
  return obj
}
