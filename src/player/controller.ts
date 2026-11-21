import * as THREE from 'three'
import type { RoomId } from '../content/types'
import { angleLerp, clamp, damp } from '../core/util'
import type { Nav } from '../world/nav'
import type { Avatar } from './avatar'

export class Controller {
  x = 0
  z = 17
  y = 0
  yaw = 0
  camYaw = 0
  camPitch = 0.04
  camDist = 6
  speed = 0
  room: RoomId = 'lobby'
  keys = new Set<string>()
  joy = { x: 0, y: 0 }
  enabled = false
  private camPos = new THREE.Vector3()
  private look = new THREE.Vector3()

  constructor(
    public nav: Nav,
    public avatar: Avatar,
    public camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
  ) {
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return
      this.keys.add(e.code)
    })
    addEventListener('keyup', (e) => this.keys.delete(e.code))
    addEventListener('blur', () => this.keys.clear())
    let drag: { id: number; x: number; y: number } | null = null
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      dom.setPointerCapture(e.pointerId)
    })
    dom.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return
      const k = e.pointerType === 'touch' ? 0.008 : 0.005
      this.camYaw += (e.clientX - drag.x) * k
      this.camPitch = clamp(this.camPitch + (e.clientY - drag.y) * k, -0.15, 1.1)
      drag.x = e.clientX
      drag.y = e.clientY
    })
    const end = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null
    }
    dom.addEventListener('pointerup', end)
    dom.addEventListener('pointercancel', end)
    dom.addEventListener('wheel', (e) => (this.camDist = clamp(this.camDist + e.deltaY * 0.004, 2.5, 12)), { passive: true })
  }

  place(x: number, z: number, yaw: number) {
    const point = this.nav.freePoint(x, z) ?? { x, z }
    this.x = point.x
    this.z = point.z
    this.yaw = yaw
    this.camYaw = yaw
    const r = this.nav.find(this.x, this.z, 0)
    this.y = r ? this.nav.heightIn(r, this.x, this.z) : 0
    this.room = r?.room ?? 'lobby'
    this.snapCamera()
  }

  snapCamera() {
    this.computeCamera(1)
  }

  update(dt: number, t: number) {
    let ix = 0
    let iz = 0
    if (this.enabled) {
      const k = this.keys
      if (k.has('KeyW') || k.has('ArrowUp')) iz += 1
      if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1
      if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1
      if (k.has('KeyD') || k.has('ArrowRight')) ix += 1
      if (k.has('KeyQ')) this.camYaw -= dt * 1.8
      ix += this.joy.x
      iz += this.joy.y
    }
    const mag = Math.min(1, Math.hypot(ix, iz))
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || mag > 0.92
    const target = mag * (run ? 6.5 : 3.6)
    this.speed = damp(this.speed, target, 10, dt)
    let dx = 0
    let dz = 0
    if (mag > 0.05) {
      const a = Math.atan2(ix, iz) + this.camYaw
      this.yaw = angleLerp(this.yaw, a, 1 - Math.exp(-12 * dt))
      const fx = Math.sin(a)
      const fz = -Math.cos(a)
      dx = fx * this.speed * dt
      dz = fz * this.speed * dt
    }
    const r = this.nav.move(this.x, this.z, dx, dz)
    this.x = r.x
    this.z = r.z
    this.y = damp(this.y, r.y, 18, dt)
    this.room = r.room
    // camera gently follows heading when moving forward
    if (mag > 0.05 && iz > 0.2 && Math.abs(ix) < 0.3) this.camYaw = angleLerp(this.camYaw, this.yaw, 1 - Math.exp(-0.8 * dt))
    this.avatar.group.position.set(this.x, this.y, this.z)
    this.avatar.group.rotation.y = -this.yaw
    this.avatar.update(dt, this.speed, t)
    this.computeCamera(1 - Math.exp(-8 * dt))
  }

  private computeCamera(lerp: number) {
    const fx = Math.sin(this.camYaw)
    const fz = -Math.cos(this.camYaw)
    const cp = Math.cos(this.camPitch)
    let d = this.camDist
    // pull the camera in until it is inside a walkable region (cheap wall avoidance)
    for (let i = 0; i < 12; i++) {
      const cx = this.x - fx * d * cp
      const cz = this.z - fz * d * cp
      if (this.nav.find(cx, cz, 0.05)) break
      d *= 0.82
    }
    d = Math.max(1.2, d)
    const tx = this.x - fx * d * cp
    const tz = this.z - fz * d * cp
    const ty = this.y + 1.7 + Math.sin(this.camPitch) * d
    this.camPos.lerp(new THREE.Vector3(tx, ty, tz), lerp)
    this.look.lerp(new THREE.Vector3(this.x, this.y + 1.9, this.z), lerp)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.look)
  }
}
