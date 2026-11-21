import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Artwork } from '../content/types'
import { paint } from '../core/gen2d'
import { resolveMedia } from '../core/media'
import { mulberry32 } from '../core/util'
import { M } from './materials'
import { P } from './pbr'
import { archOutline } from './gothic'

export function textureFor(gen: string | undefined, seed: number | undefined, media?: string, kind?: string) {
  const tex = new THREE.CanvasTexture(paint(gen, seed ?? 1, 512))
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  if (media && (kind === 'image' || kind === 'video' || !kind)) {
    resolveMedia(media).then((url) => {
      if (!url) return
      if (kind === 'video') {
        const v = document.createElement('video')
        v.src = url
        v.loop = true
        v.muted = true
        v.playsInline = true
        v.crossOrigin = 'anonymous'
        v.play().catch(() => {})
        const vt = new THREE.VideoTexture(v)
        vt.colorSpace = THREE.SRGBColorSpace
        mat.map = vt
        mat.needsUpdate = true
      } else {
        new THREE.TextureLoader().load(url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          mat.map = t
          mat.needsUpdate = true
        })
      }
    })
  }
  return mat
}

/** Framed 2D artwork on a black monolith. Group origin is on the floor, facing +z. */
export function paintingStele(a: Artwork, w = 2.4) {
  const g = new THREE.Group()
  const h = w * 1.25
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, h + 1.9, 0.4), M.obsidian)
  slab.position.y = (h + 1.9) / 2
  g.add(slab)
  const img = new THREE.Mesh(new THREE.PlaneGeometry(w, h), textureFor(a.gen, a.seed, a.media, a.kind))
  img.position.set(0, 1.2 + h / 2, 0.21)
  g.add(img)
  const fr = archOutline(w + 0.3, h + 0.5, 0.045)
  fr.position.set(0, 1.05, 0.23)
  g.add(fr)
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.2, 1.2), P.marbleBlack)
  base.position.y = 0.1
  g.add(base)
  const led = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.035, 0.035), P.gold)
  led.position.set(0, 0.22, 0.6)
  g.add(led)
  return g
}

/** Generative real-time sculpture on a pedestal. */
export function sculpture(a: Artwork) {
  const g = new THREE.Group()
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.1, 8), P.marbleBlack)
  ped.position.y = 0.55
  g.add(ped)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 4, 32), P.gold)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 1.11
  g.add(ring)
  const holder = new THREE.Group()
  holder.position.y = 2.4
  g.add(holder)
  const chrome = new THREE.MeshStandardMaterial({ color: '#d8ccff', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 })
  const rng = mulberry32(a.seed ?? 1)
  let tick: (t: number) => void = () => {}
  if (a.kind === 'model' && a.media) {
    resolveMedia(a.media).then((url) => {
      if (!url) return
      new GLTFLoader().load(url, (gl) => {
        const box = new THREE.Box3().setFromObject(gl.scene)
        const size = box.getSize(new THREE.Vector3()).length() || 1
        gl.scene.scale.setScalar(2.2 / size)
        const c = box.getCenter(new THREE.Vector3()).multiplyScalar(2.2 / size)
        gl.scene.position.sub(c)
        holder.add(gl.scene)
      })
    })
    tick = (t) => (holder.rotation.y = t * 0.3)
  } else if (a.kind === 'image' || a.kind === 'video') {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), textureFor(a.gen, a.seed, a.media, a.kind))
    p.material.side = THREE.DoubleSide
    holder.add(p)
    tick = (t) => (holder.rotation.y = Math.sin(t * 0.4) * 0.6)
  } else {
    switch (a.gen) {
      case 'liquid': {
        const geo = new THREE.IcosahedronGeometry(0.8, 5)
        const base = (geo.attributes.position.array as Float32Array).slice()
        const m = new THREE.Mesh(geo, chrome)
        holder.add(m)
        const pos = geo.attributes.position as THREE.BufferAttribute
        let frame = 0
        tick = (t) => {
          if (frame++ % 2) return
          for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3]
            const y = base[i * 3 + 1]
            const z = base[i * 3 + 2]
            const d = 1 + 0.18 * Math.sin(x * 3 + t * 1.7) * Math.sin(y * 4 + t * 1.3) + 0.1 * Math.sin(z * 5 - t * 2.1)
            pos.setXYZ(i, x * d, y * d, z * d)
          }
          pos.needsUpdate = true
          geo.computeVertexNormals()
          m.rotation.y = t * 0.2
        }
        break
      }
      case 'knot': {
        const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.18, 160, 16, 2 + Math.floor(rng() * 3), 3 + Math.floor(rng() * 3)), chrome)
        holder.add(m)
        tick = (t) => {
          m.rotation.y = t * 0.4
          m.rotation.x = Math.sin(t * 0.3) * 0.4
        }
        break
      }
      case 'lattice': {
        const n = 5
        const im = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07), M.neon, n * n * n)
        holder.add(im)
        const mtx = new THREE.Matrix4()
        tick = (t) => {
          let i = 0
          for (let x = 0; x < n; x++)
            for (let y = 0; y < n; y++)
              for (let z = 0; z < n; z++) {
                const f = Math.sin(t + x * 0.8 + y * 0.6 + z * 0.4) * 0.12
                mtx.makeTranslation((x - 2) * 0.32 + f, (y - 2) * 0.32 - f, (z - 2) * 0.32 + f)
                im.setMatrixAt(i++, mtx)
              }
          im.instanceMatrix.needsUpdate = true
          holder.rotation.y = t * 0.25
          holder.rotation.x = t * 0.1
        }
        break
      }
      case 'bust': {
        const pts: number[] = []
        for (let i = 0; i < 2600; i++) {
          const u = rng() * Math.PI * 2
          const v = Math.acos(2 * rng() - 1)
          const r = 0.5
          let x = Math.sin(v) * Math.cos(u) * r * 0.85
          let y = Math.cos(v) * r * 1.1 + 0.25
          let z = Math.sin(v) * Math.sin(u) * r
          if (i % 4 === 0) {
            const a2 = rng() * Math.PI * 2
            x = Math.cos(a2) * (0.2 + rng() * 0.5)
            z = Math.sin(a2) * 0.25
            y = -0.4 - rng() * 0.5
          }
          if (z > 0.35 && Math.abs(x) < 0.08 && y > 0.1 && y < 0.4) z += 0.08
          pts.push(x, y, z)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.025, color: new THREE.Color('#e9e0ff').multiplyScalar(1.6), toneMapped: false }))
        holder.add(p)
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 4, 64), M.neon)
        halo.rotation.x = 1.2
        holder.add(halo)
        tick = (t) => {
          p.rotation.y = Math.sin(t * 0.4) * 0.8
          halo.rotation.z = t * 0.6
        }
        break
      }
      case 'ribbon': {
        const pts: THREE.Vector3[] = []
        for (let i = 0; i <= 200; i++) {
          const s = (i / 200) * Math.PI * 2
          pts.push(new THREE.Vector3(Math.sin(s * 2) * 0.8, Math.sin(s * 3) * 0.6, Math.cos(s * 2 + 1) * 0.8))
        }
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 300, 0.05, 8, true), chrome)
        const glow = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 300, 0.015, 4, true), M.neon)
        glow.scale.setScalar(1.12)
        holder.add(m, glow)
        tick = (t) => {
          holder.rotation.y = t * 0.3
          glow.rotation.x = t * 0.5
        }
        break
      }
      default: {
        // angel: body + two wings of glowing filaments
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 8, 1, true), chrome)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), chrome)
        head.position.y = 0.9
        holder.add(body, head)
        const wings = new THREE.Group()
        for (const s of [-1, 1]) {
          for (let i = 0; i < 9; i++) {
            const curve = new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(0, 0.4, -0.1),
              new THREE.Vector3(s * (0.5 + i * 0.08), 0.9 + i * 0.05, -0.3),
              new THREE.Vector3(s * (0.9 + i * 0.07), -0.6 + i * 0.12, -0.25),
            )
            wings.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 3), M.neon))
          }
        }
        holder.add(wings)
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 4, 32), M.neonWhite)
        halo.position.y = 1.15
        halo.rotation.x = Math.PI / 2
        holder.add(halo)
        tick = (t) => {
          wings.scale.x = 1 + Math.sin(t * 1.2) * 0.08
          holder.rotation.y = Math.sin(t * 0.3) * 0.7
        }
      }
    }
  }
  holder.position.y = 2.4
  return { group: g, tick: (t: number) => tick(t) }
}
