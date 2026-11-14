import * as THREE from 'three'
import { mulberry32 } from '../core/util'
import { shared } from './materials'

/**
 * Gaussian point cloud floating in the dome. Each payment injects a pulse:
 * energy rises (tension overload), points flow like liquid and colors shift.
 */
export function createCloud(count: number) {
  const rng = mulberry32(777)
  const gauss = () => {
    let u = 0
    let v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count * 4)
  const blobs = Array.from({ length: 7 }, (_, i) => ({
    c: new THREE.Vector3(gauss() * 2.2, gauss() * 1.4, gauss() * 2.2),
    s: new THREE.Vector3(1.4 + rng() * 1.8, 1 + rng() * 1.6, 1.4 + rng() * 1.8),
    k: i,
  }))
  for (let i = 0; i < count; i++) {
    const shell = rng() < 0.18
    if (shell) {
      // orbital rings like the diamond-and-rings motif in the concept art
      const ring = Math.floor(rng() * 3)
      const a = rng() * Math.PI * 2
      const r = 5.2 + ring * 1.1 + gauss() * 0.08
      const v = new THREE.Vector3(Math.cos(a) * r, gauss() * 0.06, Math.sin(a) * r)
      v.applyEuler(new THREE.Euler(0.5 + ring * 0.7, ring * 1.1, 0.25 * ring))
      pos.set([v.x, v.y, v.z], i * 3)
      seed.set([rng(), rng(), rng(), 1], i * 4)
    } else {
      const b = blobs[Math.floor(rng() * blobs.length)]
      pos.set([b.c.x + gauss() * b.s.x * 0.6, b.c.y + gauss() * b.s.y * 0.6, b.c.z + gauss() * b.s.z * 0.6], i * 3)
      seed.set([rng(), rng(), rng(), 0], i * 4)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
  const uniforms = {
    uTime: shared.time,
    uEnergy: shared.energy,
    uPulse: { value: 0 },
    uPulseSeed: { value: 0 },
    uSize: { value: Math.min(window.devicePixelRatio, 2) * 34 },
    uLav: shared.lavender,
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime; uniform float uEnergy; uniform float uPulse; uniform float uPulseSeed; uniform float uSize;
      varying vec3 vCol; varying float vA;
      vec3 flow(vec3 p, float t){
        return vec3(
          sin(p.y*0.9 + t*0.7 + aSeed.x*6.28) + sin(p.z*0.6 - t*0.4),
          sin(p.z*0.8 + t*0.5 + aSeed.y*6.28) * 0.7,
          sin(p.x*0.7 - t*0.6 + aSeed.z*6.28) + cos(p.y*0.5 + t*0.3));
      }
      void main(){
        vec3 p = position;
        float t = uTime;
        float e = uEnergy;
        if (aSeed.w > 0.5) {
          float a = t * (0.15 + aSeed.x*0.1) * (1.0 + e*2.0);
          float c = cos(a), s = sin(a);
          p.xz = mat2(c, -s, s, c) * p.xz;
          p *= 1.0 + sin(t*2.0 + aSeed.y*20.0)*0.01 + e*0.12;
        } else {
          vec3 f = flow(p*0.6, t*(0.6 + e*1.5));
          p += f * (0.35 + e*1.6);
          // liquid overload: shells swell and fold
          float r = length(p);
          p *= 1.0 + e*0.35*sin(r*2.5 - t*4.0 + uPulseSeed);
          p.y += sin(p.x*1.3 + t*1.7) * e * 0.8;
        }
        // payment shockwave
        float wave = exp(-pow(length(position) - uPulse*9.0, 2.0)) * (1.0 - min(uPulse, 1.0));
        p += normalize(position + 0.001) * wave * 1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float sz = (0.6 + aSeed.y*1.2) * (1.0 + e*0.8 + wave*2.0);
        gl_PointSize = uSize * sz / -mv.z;
        vec3 lav = vec3(0.72, 0.6, 1.0);
        vec3 blue = vec3(0.35, 0.45, 1.0);
        vec3 white = vec3(1.0);
        vCol = mix(mix(lav, blue, aSeed.z), white, pow(aSeed.x, 6.0) + e*0.3 + wave);
        vCol = mix(vCol, vec3(1.0, 0.55, 0.95), e * 0.35 * aSeed.y);
        vA = (0.35 + 0.65*aSeed.x) * (0.55 + e*0.8);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float g = exp(-dot(d,d)*18.0);
        gl_FragColor = vec4(vCol * g * vA * 1.6, g * vA);
      }`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  return {
    points,
    uniforms,
    pulse(seedValue: number) {
      uniforms.uPulse.value = 0.0001
      uniforms.uPulseSeed.value = (seedValue % 1000) / 100
    },
    update(dt: number) {
      if (uniforms.uPulse.value > 0) {
        uniforms.uPulse.value += dt * 0.5
        if (uniforms.uPulse.value > 1.2) uniforms.uPulse.value = 0
      }
    },
  }
}
