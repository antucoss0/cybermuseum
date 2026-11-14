import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import './style.css'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Engine } from './core/engine'
import { detectQuality, isTouch } from './core/util'
import { content } from './content/store'
import type { GameDoor, RoomId } from './content/types'
import { payments, type PaymentEvent } from './payments/bus'
import { createSky } from './world/sky'
import { createCloud } from './world/cloud'
import { shared } from './world/materials'
import { buildWorld, type World } from './world/world'
import type { Hooks } from './world/rooms'
import { Controller } from './player/controller'
import { createAvatar, type Avatar, type AvatarKind } from './player/avatar'
import { Hud } from './ui/hud'
import { intro, landing, selectCharacter } from './ui/landing'
import { playGame } from './ui/games'
import { Multi } from './net/multi'
import { openAdmin } from './admin/admin'

const params = new URLSearchParams(location.search)
const quality = (params.get('q') as 'low' | 'mid' | 'high') || detectQuality()
const ui = document.getElementById('ui')!
const engine = new Engine(document.getElementById('gl') as HTMLCanvasElement, quality)
const { scene, camera } = engine

const pmrem = new THREE.PMREMGenerator(engine.renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.35

const sky = createSky()
sky.setPalette(content.data.settings.palette)
scene.add(sky.mesh)
scene.add(new THREE.HemisphereLight('#8b7bd6', '#0a0812', 0.3))
const cloudLight = new THREE.PointLight('#b89cff', 140, 0, 1.5)
cloudLight.position.set(0, 8, 0)
scene.add(cloudLight)
const cloud = createCloud(quality === 'low' ? 9000 : quality === 'mid' ? 18000 : 32000)
cloud.points.position.set(0, 8.2, 0)
scene.add(cloud.points)

let hud: Hud | null = null
let controller: Controller | null = null
const multi = new Multi()
let me: { kind: AvatarKind; name: string } | null = null

const hooks: Hooks = {
  openArt: (a) => hud?.openArt(a),
  openShop: (p) => hud?.openShop(p),
  openGame: (g) => hud?.openGame(g, startGame),
  openCall: () => hud?.openCall(),
  openEvents: () => hud?.openEvents(),
  donate: () => hud?.openPay(100, controller?.room === 'jardin' ? 'Una flor para el jardín' : 'Ofrenda a la nube', controller?.room === 'jardin' ? 'jardin' : 'donacion'),
  nextFilm: () => {},
}

let world: World = buildWorld(content.data, hooks)
scene.add(world.group)
for (const p of [...payments.list].reverse().slice(-220)) world.addPlant(p, false)

let rebuildTimer = 0
content.changed.on(() => {
  clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(() => {
    scene.remove(world.group)
    world.dispose()
    world = buildWorld(content.data, hooks)
    scene.add(world.group)
    for (const p of [...payments.list].reverse().slice(-220)) world.addPlant(p, false)
    sky.setPalette(content.data.settings.palette)
    if (controller) {
      controller.nav = world.nav
      const r = world.nav.find(controller.x, controller.z, 0)
      if (!r) place(controller.room)
    }
    hud?.renderDrawer()
  }, 250)
})

// ---------- payment reactions ----------
let energy = 0
let ripple = 0
const baseLav = new THREE.Color('#b89cff')
const hot = new THREE.Color()
function react(p: PaymentEvent, fresh = true) {
  const k = Math.min(1, 0.25 + Math.log10(1 + p.amount) / 3.2)
  energy = Math.min(1.6, energy + k)
  cloud.pulse(p.seed)
  hot.setHSL(((p.seed % 360) / 360) * 0.25 + 0.72, 0.9, 0.72)
  const origins = [[0, 0], [0, 52]]
  for (const [x, z] of origins) {
    shared.ripples.value[ripple % 4].set(x, z, engine.time, k + 0.4)
    ripple++
  }
  world.addPlant(p, fresh)
}
payments.received.on((p) => {
  react(p)
  multi.broadcastPayment(p)
})
multi.payment.on((p) => payments.ingest(p))

// ---------- peers ----------
const peers = new Map<string, { av: Avatar; target: THREE.Vector3; yaw: number; speed: number; kind: string }>()
function peerAvatar(id: string, kind: string, name: string) {
  let p = peers.get(id)
  if (p && p.kind !== kind) {
    scene.remove(p.av.group)
    p = undefined
  }
  if (!p) {
    const av = createAvatar((kind as AvatarKind) || 'oraculo')
    scene.add(av.group)
    p = { av, target: new THREE.Vector3(0, 0, 12), yaw: 0, speed: 0, kind }
    peers.set(id, p)
  }
  p.av.setTag(name)
  return p
}
multi.profile.on(({ id, profile }) => {
  peerAvatar(id, profile.kind, profile.name)
  hud?.chat('', `${profile.name} entró al museo`, true)
})
multi.pose.on(({ id, pose }) => {
  const info = multi.peers.get(id)?.profile
  const p = peers.get(id) ?? peerAvatar(id, info?.kind ?? 'oraculo', info?.name ?? 'Visitante')
  p.target.set(pose.x, pose.y, pose.z)
  p.yaw = pose.yaw
  p.speed = pose.speed
  if (p.av.group.position.lengthSq() === 0) p.av.group.position.copy(p.target)
})
multi.left.on((id) => {
  const p = peers.get(id)
  if (p) scene.remove(p.av.group)
  peers.delete(id)
})
multi.count.on((n) => hud?.setOnline(n, multi.connected))
multi.chat.on(({ name, text }) => (hud?.chat(name, text), hud?.toggleChat(true)))

// ---------- game portals ----------
function startGame(g: GameDoor) {
  if (!hud) return
  if (controller) controller.enabled = false
  hud.modalOpen = true
  playGame(ui, g.target, () => {
    if (controller) controller.enabled = true
    if (hud) hud.modalOpen = false
  })
}

function place(room: RoomId) {
  const s = world.spawn(room)
  controller?.place(s.x, s.z, s.yaw)
}

// ---------- main loop ----------
let landingP = 0
let mode: 'landing' | 'museum' = 'landing'
let poseAcc = 0
const tmpV = new THREE.Vector3()
engine.onTick((dt, t) => {
  shared.time.value = t
  sky.uniforms.uTime.value = t
  energy = Math.max(0, energy - dt * 0.12 * (0.4 + energy))
  shared.energy.value = Math.min(1, energy)
  sky.uniforms.uEnergy.value = Math.min(1, energy)
  shared.lavender.value.copy(baseLav).lerp(hot, Math.min(1, energy * 0.8))
  cloudLight.color.copy(shared.lavender.value)
  cloudLight.intensity = 60 + Math.min(1, energy) * 110
  engine.bloom.strength = (quality === 'low' ? 0.6 : 0.75) + Math.min(1, energy) * 0.3
  cloud.update(dt)
  cloud.points.rotation.y = t * 0.03
  world.chandeliers.forEach((c, i) => (c.rotation.y = t * 0.05 * (i % 2 ? 1 : -1)))
  world.title.lookAt(camera.position.x, world.title.position.y, camera.position.z)
  hud?.setEnergy(energy)

  if (mode === 'landing') {
    const a = landingP * Math.PI * 2 + t * 0.03
    const r = 15 - Math.sin(landingP * Math.PI) * 5
    const y = 3 + Math.sin(landingP * Math.PI * 2) * 2 + landingP * 4
    camera.position.set(Math.sin(a) * r, y, Math.cos(a) * r)
    camera.lookAt(0, 7 + landingP * 2, 0)
    world.tick(dt, t, 'lobby')
    return
  }
  if (!controller || !hud) return
  controller.joy = hud.joy
  controller.enabled = !hud.modalOpen
  controller.update(dt, t)
  hud.setRoom(controller.room)
  world.tick(dt, t, controller.room)
  // nearest interactable
  let best: (typeof world.interactables)[number] | null = null
  let bd = Infinity
  for (const it of world.interactables) {
    const d = Math.hypot(it.pos.x - controller.x, it.pos.z - controller.z)
    if (d < it.r && d < bd && Math.abs(it.pos.y - controller.y) < 2) ((best = it), (bd = d))
  }
  nearest = best
  hud.setPrompt(best?.label ?? null)
  for (const p of peers.values()) {
    const g = p.av.group
    g.position.lerp(p.target, 1 - Math.exp(-10 * dt))
    tmpV.set(0, -p.yaw, 0)
    g.rotation.y += (Math.atan2(Math.sin(-p.yaw - g.rotation.y), Math.cos(-p.yaw - g.rotation.y))) * Math.min(1, dt * 10)
    p.av.update(dt, p.speed, t)
  }
  poseAcc += dt
  if (poseAcc > 0.1 && multi.connected) {
    poseAcc = 0
    multi.broadcastPose({ x: +controller.x.toFixed(2), y: +controller.y.toFixed(2), z: +controller.z.toFixed(2), yaw: +controller.yaw.toFixed(3), speed: +controller.speed.toFixed(2), room: controller.room })
  }
})
let nearest: World['interactables'][number] | null = null

async function enterMuseum(profile: { kind: AvatarKind; name: string }) {
  me = profile
  mode = 'museum'
  const av = createAvatar(profile.kind)
  scene.add(av.group)
  controller = new Controller(world.nav, av, camera, engine.renderer.domElement)
  hud = new Hud(ui)
  hud.playerName = profile.name
  hud.act.on(() => nearest?.action())
  hud.teleport.on((r) => place(r))
  hud.chatSend.on((text) => {
    hud!.chat(profile.name, text)
    multi.say(text)
  })
  const start = (params.get('room') as RoomId) || 'lobby'
  place(start)
  controller.enabled = true
  hud.setRoom(controller.room)
  hud.toast('Bienvenido', profile.name)
  hud.chat('', isTouch() ? 'Usa el joystick para caminar y arrastra para mirar.' : 'Bienvenido a Cybermuseo. Presiona Enter para chatear.', true)
  if (content.data.settings.multiplayer && !params.has('solo')) {
    multi.start(content.data.settings.roomName, { name: profile.name, kind: profile.kind })
    hud.setOnline(1, multi.connected)
  }
}

function handleHash() {
  if (location.hash === '#admin' && !document.getElementById('admin')) {
    if (controller) controller.enabled = false
    openAdmin(ui, () => {
      if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search)
      if (controller) controller.enabled = true
    })
  }
}
addEventListener('hashchange', handleHash)

async function boot() {
  if (params.has('skip')) {
    const saved = JSON.parse(localStorage.getItem('cm.profile') || '{}')
    await enterMuseum({ kind: (params.get('avatar') as AvatarKind) || saved.kind || 'oraculo', name: params.get('name') || saved.name || 'Visitante' })
    handleHash()
    return
  }
  const it = intro(ui)
  let p = 0
  const iv = setInterval(() => it.progress((p = Math.min(0.95, p + 0.12))), 180)
  await document.fonts?.ready
  await new Promise((r) => setTimeout(r, 400))
  clearInterval(iv)
  await it.done()
  if (location.hash === '#admin') return handleHash()
  landing(ui, (v) => (landingP = v), async () => {
    mode = 'museum'
    const a = camera.position.clone()
    const profile = await selectCharacter(ui)
    void a
    await enterMuseum(profile)
  })
}
boot()

// test / debug handle
Object.assign(window, {
  __cm: {
    get state() {
      return { mode, room: controller?.room, x: controller?.x, z: controller?.z, y: controller?.y, energy, fps: engine.fps, peers: peers.size, me }
    },
    place,
    pay: (amount = 100, payer = 'Test') => payments.ingest(payments.make(amount, 'Donación simulada', 'donacion', payer, 'sim')),
    look: (yaw: number, pitch = 0.28) => controller && ((controller.camYaw = yaw), (controller.camPitch = pitch), controller.snapCamera()),
    walk: (code: string, ms = 1000) => {
      controller?.keys.add(code)
      setTimeout(() => controller?.keys.delete(code), ms)
    },
    act: () => nearest?.action(),
    engine,
  },
})
