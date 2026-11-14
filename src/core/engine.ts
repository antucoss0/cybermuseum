import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
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

  constructor(canvas: HTMLCanvasElement, public quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' })
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : quality === 'mid' ? 1.3 : 1)
    this.renderer.setPixelRatio(dpr)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.92
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2500)
    this.scene.background = new THREE.Color('#05040a')
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const res = new THREE.Vector2(256, 256)
    this.bloom = new UnrealBloomPass(res, quality === 'low' ? 0.6 : 0.75, 0.5, 0.88)
    this.composer.addPass(this.bloom)
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
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05
    for (const t of this.ticks) t(dt, this.time)
    this.composer.render(dt)
  }
}
