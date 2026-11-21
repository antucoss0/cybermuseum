import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import type { Quality } from './util'

export type Tick = (dt: number, t: number) => void

export class Engine {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  composer: EffectComposer
  bloom: UnrealBloomPass
  clock = new THREE.Clock()
  private ticks = new Set<Tick>()
  time = 0
  running = true
  fps = 60
  rig = new THREE.Group()
  private dpr = 1
  private maxDpr = 1
  private perfT = 0
  private perfFrames = 0
  private film: ShaderPass | null = null

  constructor(canvas: HTMLCanvasElement, public quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' })
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : quality === 'mid' ? 1.3 : 1)
    this.dpr = this.maxDpr = dpr
    this.renderer.setPixelRatio(dpr)
    this.renderer.xr.enabled = true
    this.renderer.toneMapping = THREE.AgXToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2500)
    this.scene.background = new THREE.Color('#05040a')
    this.rig.add(this.camera)
    this.scene.add(this.rig)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const res = new THREE.Vector2(256, 256)
    this.bloom = new UnrealBloomPass(res, quality === 'low' ? 0.6 : 0.75, 0.35, 0.88)
    this.composer.addPass(this.bloom)
    if (quality !== 'low') {
      this.film = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse;
          uniform float uTime;
          varying vec2 vUv;
          float grainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 41.0) * 43758.5453); }
          void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float edge = 1.0 - smoothstep(0.25, 0.88, length((vUv - 0.5) * vec2(1.0, 0.78)));
            color.rgb *= mix(0.93, 1.0, edge);
            color.rgb += (grainHash(gl_FragCoord.xy) - 0.5) * 0.012;
            gl_FragColor = color;
          }`,
      })
      this.composer.addPass(this.film)
    }
    if (quality === 'high') this.composer.addPass(new SMAAPass())
    this.composer.addPass(new OutputPass())
    this.resize()
    addEventListener('resize', () => this.resize())
    this.renderer.setAnimationLoop(() => this.frame())
  }

  resize() {
    const w = innerWidth
    const h = innerHeight
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    const scale = this.quality === 'high' ? 0.5 : 0.35
    this.bloom.resolution.set(w * scale, h * scale)
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 72 : 62
    this.camera.updateProjectionMatrix()
  }

  onTick(fn: Tick) {
    this.ticks.add(fn)
    return () => this.ticks.delete(fn)
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1)
    if (!this.running) return
    this.time += dt
    if (this.film) this.film.uniforms.uTime.value = this.time
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05
    for (const t of this.ticks) t(dt, this.time)
    if (this.renderer.xr.isPresenting) this.renderer.render(this.scene, this.camera)
    else {
      this.composer.render(dt)
      this.adapt(dt)
    }
  }

  /** Dynamic resolution: drops pixel ratio when the device can't hold ~45 fps, restores it when it can. */
  private adapt(dt: number) {
    this.perfT += dt
    this.perfFrames++
    if (this.perfT < 2) return
    const fps = this.perfFrames / this.perfT
    this.perfT = this.perfFrames = 0
    let next = this.dpr
    if (fps < 40) next = Math.max(0.6, this.dpr * 0.85)
    else if (fps > 57) next = Math.min(this.maxDpr, this.dpr * 1.08)
    if (Math.abs(next - this.dpr) > 0.02) {
      this.dpr = next
      this.renderer.setPixelRatio(next)
      this.resize()
    }
  }
}
