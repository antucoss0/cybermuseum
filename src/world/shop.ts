import * as THREE from 'three'
import type { Content } from '../content/types'
import { shared } from './materials'
import type { Wing } from './building'
import { CORRIDOR_END } from './building'

/** T-shirt silhouette, extruded, with a cloth sway in the vertex shader. */
function shirt(color: string, print: string) {
  const s = new THREE.Shape()
  s.moveTo(-0.38, 0)
  s.lineTo(0.38, 0)
  s.lineTo(0.38, 0.62)
  s.lineTo(0.62, 0.5)
  s.lineTo(0.74, 0.72)
  s.lineTo(0.4, 0.95)
  s.quadraticCurveTo(0, 0.82, -0.4, 0.95)
  s.lineTo(-0.74, 0.72)
  s.lineTo(-0.62, 0.5)
  s.lineTo(-0.38, 0.62)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10 })
  geo.translate(0, -0.95, -0.03)
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(print), sheenRoughness: 0.5 })
  const seed = Math.random() * 10
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hang = clamp(-position.y, 0.0, 1.0);
      transformed.z += sin(uTime*1.6 + position.x*4.0 + ${seed.toFixed(2)}) * 0.05 * hang + sin(uTime*2.7 + position.y*6.0) * 0.015 * hang;
      transformed.x += sin(uTime*1.1 + ${seed.toFixed(2)}) * 0.03 * hang;`)
  }
  const m = new THREE.Mesh(geo, mat)
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), new THREE.MeshBasicMaterial({ color: print, toneMapped: false }))
  logo.position.set(0, -0.42, 0.07)
  m.add(logo)
  const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#d9d4e8', metalness: 1, roughness: 0.2 }))
  hanger.position.y = 0.05
  m.add(hanger)
  return m
}

export function shopDecor(w: Wing, c: Content) {
  const z0 = -CORRIDOR_END
  const g = new THREE.Group()
  g.position.y = w.floorY
  w.group.add(g)
  const cols = ['#ff4fd8', '#7cf2e4', '#b89cff', '#ffd27c']
  // neon tubes zig-zagging along both walls and over the ceiling
  for (const sd of [-1, 1])
    for (let k = 0; k < 2; k++) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(sd * (w.W / 2 - 0.15), 2.4 + k * 2 + (i % 2 ? 0.7 : 0), z0 - 1 - (i / 10) * (w.L - 2)))
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 120, 0.035, 6), new THREE.MeshBasicMaterial({ color: cols[(k + (sd > 0 ? 1 : 0)) % 4], toneMapped: false }))
      g.add(tube)
    }
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(w.W / 2 - 0.6, 0.04, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: cols[i % 4], toneMapped: false }))
    arc.position.set(0, 4.2, z0 - 2 - i * ((w.L - 4) / 4))
    g.add(arc)
  }
  // central rotating rack of 3D shirts
  const rack = new THREE.Group()
  rack.position.set(0, 0, z0 - w.L / 2)
  g.add(rack)
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 32), new THREE.MeshStandardMaterial({ color: '#0d0b16', metalness: 0.8, roughness: 0.2 }))
  pod.position.y = 0.2
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: '#ff4fd8', toneMapped: false }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.42
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#d9d4e8', metalness: 1, roughness: 0.2 }))
  pole.position.y = 1.7
  rack.add(pod, ring, pole)
  const spin = new THREE.Group()
  spin.position.y = 2.9
  rack.add(spin)
  const shirts = c.products.filter((p) => p.visible !== false && /playera|shirt|tee/i.test(p.name + p.category))
  const n = Math.max(4, shirts.length)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const sh = shirt(['#141018', '#ece8ff', '#2a1d4a', '#0b2a2a'][i % 4], cols[i % 4])
    sh.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1)
    sh.rotation.y = -a + Math.PI / 2
    spin.add(sh)
  }
  const glow = new THREE.PointLight('#ff6fe0', 10, 8, 1.6)
  glow.position.y = 3.5
  rack.add(glow)
  w.obstacle(0, z0 - w.L / 2, 1.8)
  return { tick: (t: number) => (spin.rotation.y = t * 0.25) }
}
