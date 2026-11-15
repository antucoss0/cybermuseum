import * as THREE from 'three'
import type { Engine } from './engine'

export type XRMode = 'immersive-vr' | 'immersive-ar'

/** WebXR helper: VR walks the museum in first person, AR places the whole cathedral as a table-top diorama. */
export class XR {
  mode: XRMode | null = null
  supported: Record<XRMode, boolean> = { 'immersive-vr': false, 'immersive-ar': false }
  axes = { x: 0, y: 0, turn: 0 }
  private session: XRSession | null = null
  private snapCooldown = 0
  onChange: (mode: XRMode | null) => void = () => {}

  constructor(private engine: Engine) {}

  async detect() {
    const xr = (navigator as any).xr
    if (!xr?.isSessionSupported) return this.supported
    for (const m of ['immersive-vr', 'immersive-ar'] as XRMode[]) {
      try {
        this.supported[m] = await xr.isSessionSupported(m)
      } catch {}
    }
    return this.supported
  }

  async enter(mode: XRMode) {
    const xr = (navigator as any).xr
    if (!xr) throw new Error('WebXR no disponible')
    if (this.session) return this.session.end()
    const session: XRSession = await xr.requestSession(mode, {
      requiredFeatures: mode === 'immersive-ar' ? ['local'] : ['local-floor'],
      optionalFeatures: ['bounded-floor', 'hand-tracking', 'layers', 'dom-overlay'],
      ...(mode === 'immersive-ar' ? { domOverlay: { root: document.getElementById('ui')! } } : {}),
    })
    const r = this.engine.renderer
    r.xr.setReferenceSpaceType(mode === 'immersive-ar' ? 'local' : 'local-floor')
    await r.xr.setSession(session)
    this.session = session
    this.mode = mode
    this.onChange(mode)
    session.addEventListener('end', () => {
      this.session = null
      this.mode = null
      this.engine.rig.position.set(0, 0, 0)
      this.engine.rig.rotation.set(0, 0, 0)
      this.engine.rig.scale.setScalar(1)
      this.onChange(null)
    })
  }

  /** Reads thumbsticks; returns headset yaw so locomotion follows the gaze. */
  poll(dt: number) {
    this.axes.x = this.axes.y = 0
    this.snapCooldown -= dt
    const s = this.session
    if (!s) return
    for (const src of s.inputSources) {
      const gp = src.gamepad
      if (!gp || gp.axes.length < 2) continue
      const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0]
      const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1]
      if (src.handedness === 'right') {
        if (Math.abs(ax) > 0.7 && this.snapCooldown <= 0) {
          this.engine.rig.rotation.y -= Math.sign(ax) * (Math.PI / 6)
          this.snapCooldown = 0.35
        }
      } else {
        this.axes.x = Math.abs(ax) > 0.15 ? ax : 0
        this.axes.y = Math.abs(ay) > 0.15 ? -ay : 0
      }
    }
  }

  headYaw() {
    const cam = this.engine.renderer.xr.getCamera()
    const e = new THREE.Euler().setFromQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()), 'YXZ')
    return -e.y
  }
}
