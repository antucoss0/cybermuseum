import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import './style.css'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Engine } from './core/engine'
import { L, tx } from './core/i18n'
import { CORRIDOR_END, LOBBY_R } from './world/building'
import { detectQuality, isTouch } from './core/util'
import { content } from './content/store'
import type { GameDoor, RoomId } from './content/types'
import { payments, type PaymentEvent } from './payments/bus'
import { checkSession } from './payments/provider'
import { createSky } from './world/sky'
import { createCloud } from './world/cloud'
import { shared } from './world/materials'
import { buildWorld, type World } from './world/world'
import type { Hooks } from './world/rooms'
import type { SpaceHooks } from './world/spaces'
import type { ExtraHooks } from './world/extras'
import { Controller } from './player/controller'
import { createAvatar, type Avatar, type AvatarKind } from './player/avatar'
import { Hud } from './ui/hud'
import { intro, landing, selectCharacter } from './ui/landing'
import { playGame } from './ui/games'
import { Multi } from './net/multi'
import { openAdmin } from './admin/admin'
import { audio } from './core/audio'
import { XR } from './core/xr'

const params = new URLSearchParams(location.search)
const quality = (params.get('q') as 'low' | 'mid' | 'high') || detectQuality()
const ui = document.getElementById('ui')!
const engine = new Engine(document.getElementById('gl') as HTMLCanvasElement, quality)
const { scene, camera } = engine
const xr = new XR(engine)
const unlockAudio = () => audio.unlock()
addEventListener('pointerdown', unlockAudio)
addEventListener('keydown', unlockAudio)

const pmrem = new THREE.PMREMGenerator(engine.renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.35

const sky = createSky()
sky.setPalette(content.data.settings.palette)
scene.add(sky.mesh)
scene.add(new THREE.HemisphereLight('#8b7bd6', '#0a0812', 0.3))
const cloudLight = new THREE.PointLight('#b89cff', 140, 0, 1.5)
cloudLight.position.set(0, 10.5, 0)
scene.add(cloudLight)
const cloud = createCloud(quality === 'low' ? 14000 : quality === 'mid' ? 30000 : 56000)
cloud.points.position.set(0, 9, 0)
cloud.points.scale.setScalar(1.55)
scene.add(cloud.points)

let hud: Hud | null = null
let controller: Controller | null = null
const multi = new Multi()
let me: { kind: AvatarKind; name: string } | null = null

const hooks: Hooks & SpaceHooks & ExtraHooks = {
  openPiece: (h, p) => hud?.openPiece(h, p),
  openHall: (h) => hud?.openHall(h),
  openUrl: (url) => window.open(url, '_blank', 'noopener'),
  goto: (target, title, kicker) => {
    hud?.portal(kicker, title)
    audio.whoosh()
    setTimeout(() => controller?.place(target.x, target.z, target.yaw), 380)
  },
  openForum: () => hud?.openForum(),
  openCalls: () => hud?.openCalls(),
  openAbout: () => hud?.openAbout(),
  openArt: (a) => hud?.openArt(a),
  openShop: (p) => hud?.openShop(p),
  openGame: (g) => hud?.openGame(g, startGame),
  openCall: () => hud?.openCall(),
  openEvents: () => hud?.openEvents(),
  donate: () => hud?.openPay(100, controller?.room === 'jardin' ? L('Una flor para el jardín', 'A flower for the garden') : L('Ofrenda a la nube', 'Offering to the cloud'), controller?.room === 'jardin' ? 'jardin' : 'donacion'),
  nextFilm: () => {},
  openCatalog: (play) => hud?.openCatalog(play),
  voice: () =>
    multi
      .voice()
      .then((on) => hud?.toast(L('Micrófono', 'Microphone'), on ? L('Activo · te escuchan en la sala', 'Live · the room can hear you') : L('Silenciado', 'Muted')))
      .catch(() => hud?.toast(L('Micrófono', 'Microphone'), L('Permiso denegado', 'Permission denied'))),
  sit: (eye, look) => {
    seat = { eye: eye.clone(), look: look.clone() }
    hud?.setPrompt(L('Levantarse', 'Stand up'))
  },
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

content.pull()
const paidId = params.get('paid')
if (paidId) {
  history.replaceState(null, '', location.pathname + location.hash)
  checkSession(paidId).then((ev) => ev && payments.ingest(ev)).catch(() => {})
}

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
  audio.chime(p.amount)
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
  hud?.chat('', `${profile.name} ${L('entró al museo', 'entered the museum')}`, true)
})
multi.pose.on(({ id, pose }) => {
  const info = multi.peers.get(id)?.profile
  const p = peers.get(id) ?? peerAvatar(id, info?.kind ?? 'oraculo', info?.name ?? L('Visitante', 'Visitor'))
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
  const s = room === 'foro' ? world.forumSpawn() : room === 'juntas' ? world.juntasSpawn() : world.spawn(room)
  controller?.place(s.x, s.z, s.yaw)
}

// ---------- main loop ----------
let landingP = 0
let mode: 'landing' | 'museum' | 'cinematic' = 'landing'
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
  cloudLight.intensity = 110 + Math.min(1, energy) * 180
  engine.bloom.strength = (quality === 'low' ? 0.6 : 0.75) + Math.min(1, energy) * 0.3
  cloud.update(dt)
  cloud.points.rotation.y = t * 0.03
  world.chandeliers.forEach((c, i) => (c.rotation.y = t * 0.05 * (i % 2 ? 1 : -1)))
  world.title.lookAt(camera.position.x, world.title.position.y, camera.position.z)
  hud?.setEnergy(energy)
  if (portalKick > 0 && !xr.mode) {
    portalKick = Math.max(0, portalKick - dt * 1.2)
    const k = Math.sin(portalKick * Math.PI)
    camera.fov = (innerWidth < innerHeight ? 72 : 62) + k * 22
    camera.updateProjectionMatrix()
    engine.bloom.strength += k * 0.8
  }

  if (mode === 'landing') {
    const a = landingP * Math.PI * 2 + t * 0.03
    const r = 15 - Math.sin(landingP * Math.PI) * 5
    const y = 3 + Math.sin(landingP * Math.PI * 2) * 2 + landingP * 4
    camera.position.set(Math.sin(a) * r, y, Math.cos(a) * r)
    camera.lookAt(0, 7 + landingP * 2, 0)
    cloud.points.rotation.y = landingP * Math.PI * 1.5 + t * 0.02
    cloud.points.scale.setScalar(1 + Math.sin(landingP * Math.PI) * 0.35)
    world.tick(dt, t, 'lobby')
    return
  }
  if (viewHold) {
    camera.position.copy(viewHold[0])
    camera.lookAt(viewHold[1])
    world.tick(dt, t, 'jardin')
    return
  }
  if (mode === 'cinematic' && cine) {
    cine.t += dt
    const u = Math.min(1, cine.t / cine.dur)
    const e = u * u * u * (u * (u * 6 - 15) + 10)
    camera.position.copy(cine.pos.getPoint(e))
    camera.lookAt(cine.look.getPoint(e))
    const seg = Math.min(cine.caps.length - 1, Math.floor(e * cine.caps.length))
    if (seg !== cine.seg) ((cine.seg = seg), cine.onSeg(seg))
    world.tick(dt, t, cine.rooms[seg] ?? 'lobby')
    if (u >= 1) cine.end()
    return
  }
  if (!controller || !hud) return
  if (seat && !xr.mode) {
    controller.enabled = false
    controller.avatar.group.visible = false
    camera.position.lerp(seat.eye, Math.min(1, dt * 4))
    camera.lookAt(seat.look)
    world.tick(dt, t, controller.room)
    hud.setPrompt(L('Levantarse', 'Stand up'))
    return
  }
  controller.enabled = !hud.modalOpen
  if (xr.mode) {
    xr.poll(dt)
    controller.joy = { x: xr.axes.x, y: xr.axes.y }
    if (xr.mode === 'immersive-vr') controller.camYaw = xr.headYaw()
  } else controller.joy = hud.joy
  controller.update(dt, t)
  if (xr.mode === 'immersive-vr') {
    engine.rig.position.set(controller.x, controller.y, controller.z)
    controller.avatar.group.visible = false
  } else if (xr.mode === 'immersive-ar') {
    const s = 40
    engine.rig.scale.setScalar(s)
    engine.rig.position.set(0, -0.8 * s, 1.2 * s)
  } else controller.avatar.group.visible = true
  audio.tick(dt, controller.speed, me?.kind === 'astral')
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
let seat: { eye: THREE.Vector3; look: THREE.Vector3 } | null = null
let nearest: World['interactables'][number] | null = null
let cine: { t: number; dur: number; seg: number; pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3; caps: [string, string][]; rooms: (RoomId | undefined)[]; onSeg: (i: number) => void; end: () => void } | null = null

/** AAA-style fly-through: galaxy exterior → dome → Gaussian cloud → four wings → the visitor. */
function cinematic(): Promise<void> {
  return new Promise((res) => {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const wing = (r: RoomId) => world.wings.find((w) => w.room === r)!
    const peek = (r: RoomId): [THREE.Vector3, THREE.Vector3] => [wing(r).world(0, -LOBBY_R + 6, 4.2), wing(r).world(0, -CORRIDOR_END - 14, 2.6)]
    const nm = (r: RoomId) => tx(content.data.rooms[r], 'name')
    const sub = (r: RoomId) => tx(content.data.rooms[r], 'subtitle')
    const shots: [THREE.Vector3, THREE.Vector3, [string, string], RoomId?][] = [
      [V(0, 90, 150), V(0, 12, 0), [L('Ethercoded presenta', 'Ethercoded presents'), '']],
      [V(14, 64, 26), V(0, 18, 0), ['', 'CYBER MUSEUM']],
      [V(2, 34, 3), V(0, 8, 0), ['', '']],
      [V(15, 15, 13), V(0, 10, 0), [L('Pieza central', 'Centerpiece'), L('La Nube Gaussiana', 'The Gaussian Cloud')]],
      [V(-5, 2.5, 12), V(0, 17, 0), [L('La bóveda', 'The vault'), L('Un templo renacentista del futuro', 'A Renaissance temple of the future')]],
      [...peek('videosala'), [sub('videosala'), nm('videosala')], 'videosala'],
      [...peek('pintura'), [sub('pintura'), nm('pintura')], 'pintura'],
      [...peek('jardin'), [sub('jardin'), nm('jardin')], 'jardin'],
      [...peek('videojuegos'), [sub('videojuegos'), nm('videojuegos')], 'videojuegos'],
      [V(0, 10, 25), V(0, 9, 0), ['', L('Arte · Tecnología · Eternidad', 'Art · Technology · Eternity')]],
      [V(0, 3.4, 21.2), V(0, 1.9, 16), ['', '']],
    ]
    const el = document.createElement('div')
    el.id = 'cine'
    el.innerHTML = `<div class="fade"></div><div class="bar t"></div><div class="bar b"></div><div class="cap"><span class="kicker"></span><h2 class="serif"></h2></div><button class="btn ghost sm skip">${L('Saltar', 'Skip')} ⏭</button>`
    ui.append(el)
    requestAnimationFrame(() => el.classList.add('go'))
    const cap = el.querySelector('.cap') as HTMLElement
    mode = 'cinematic'
    audio.unlock()
    audio.setRoom('lobby', true)
    let finished = false
    const end = () => {
      if (finished) return
      finished = true
      el.classList.add('out')
      removeEventListener('keydown', key)
      setTimeout(() => el.remove(), 1300)
      cine = null
      res()
    }
    const key = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === ' ') && end()
    addEventListener('keydown', key)
    el.querySelector('.skip')!.addEventListener('click', end)
    cine = {
      t: 0,
      dur: 19,
      seg: -1,
      pos: new THREE.CatmullRomCurve3(shots.map((s) => s[0]), false, 'centripetal'),
      look: new THREE.CatmullRomCurve3(shots.map((s) => s[1]), false, 'centripetal'),
      caps: shots.slice(0, -1).map((s) => s[2]),
      rooms: shots.slice(0, -1).map((s) => s[3]),
      onSeg: (i) => {
        const [k, ttl] = cine!.caps[i]
        cap.classList.remove('show')
        void cap.offsetWidth
        ;(cap.querySelector('.kicker') as HTMLElement).textContent = k
        ;(cap.querySelector('h2') as HTMLElement).textContent = ttl
        if (k || ttl) cap.classList.add('show')
        audio.bell(220 * Math.pow(2, [0, 3, 7, 10, 12, 15, 19, 22, 24][i % 9] / 12), 0.07, 4)
        if (i > 3) audio.whoosh()
      },
      end,
    }
  })
}
let portalKick = 0
let viewHold: [THREE.Vector3, THREE.Vector3] | null = null
const bg = scene.background

async function enterMuseum(profile: { kind: AvatarKind; name: string }) {
  me = profile
  mode = 'museum'
  if (!location.hash.startsWith('#admin')) history.replaceState(null, '', location.pathname + location.search + '#/museo')
  const av = createAvatar(profile.kind)
  scene.add(av.group)
  controller = new Controller(world.nav, av, camera, engine.renderer.domElement)
  hud = new Hud(ui)
  hud.playerName = profile.name
  hud.act.on(() => (seat ? ((seat = null), controller && (controller.avatar.group.visible = true)) : nearest?.action()))
  hud.teleport.on((r) => {
    hud!.portal(L('Viajando a', 'Travelling to'), r)
    audio.whoosh()
    setTimeout(() => place(r), 380)
  })
  hud.roomChange.on((r) => {
    audio.setRoom(r)
    audio.whoosh()
    portalKick = 1
  })
  xr.detect().then((s) => hud?.showXR(s['immersive-vr'], s['immersive-ar']))
  xr.onChange = (m) => {
    sky.mesh.visible = m !== 'immersive-ar'
    scene.background = m === 'immersive-ar' ? null : bg
    document.body.classList.toggle('xr-ar', m === 'immersive-ar')
  }
  hud.xrEnter.on((m) => xr.enter(m).catch((e) => hud?.toast('XR', String(e.message ?? e))))
  audio.setRoom(controller.room)
  hud.chatSend.on((text) => {
    hud!.chat(profile.name, text)
    multi.say(text)
  })
  const meetCode = params.get('meet')
  let meeting = meetCode ? content.data.meetings.find((m) => m.active && m.code === meetCode) : undefined
  let inMeeting = false
  if (meetCode) {
    const r = await fetch(`./api/content?meet=${encodeURIComponent(meetCode)}&name=${encodeURIComponent(profile.name)}`, { cache: 'no-store' }).catch(() => null)
    if (r && r.status !== 503) {
      const j = r.ok ? await r.json() : null
      meeting = j?.meeting
      inMeeting = Boolean(j?.allowed)
    } else {
      const guests = meeting?.allowed.split(/\n|,/).map((x) => x.trim().toLowerCase()).filter(Boolean) ?? []
      inMeeting = Boolean(meeting && (!guests.length || guests.includes(profile.name.trim().toLowerCase())))
    }
  }
  if (meetCode && !inMeeting) hud.toast(L('Sala de juntas', 'Meeting room'), meeting ? L('Tu nombre no está en la lista de invitados', 'Your name is not on the guest list') : L('Enlace inválido o inactivo', 'Invalid or inactive link'))
  const start = inMeeting ? 'juntas' : (params.get('room') as RoomId) || 'lobby'
  place(start)
  controller.enabled = true
  hud.setRoom(controller.room)
  hud.toast(L('Bienvenido', 'Welcome'), profile.name)
  hud.chat('', isTouch() ? L('Usa el joystick para caminar y arrastra para mirar.', 'Use the joystick to walk and drag to look around.') : L('Bienvenido a Cyber Museum. Presiona Enter para chatear.', 'Welcome to Cyber Museum. Press Enter to chat.'), true)
  if (content.data.settings.multiplayer && !params.has('solo')) {
    multi.start(inMeeting ? `juntas-${meeting!.code}` : content.data.settings.roomName, { name: profile.name, kind: profile.kind })
    if (inMeeting)
      setTimeout(() => {
        if (multi.peers.size >= 8) hud?.toast(L('Sala llena', 'Room full'), L('La sala de juntas admite 8 personas', 'The meeting room holds 8 people'))
      }, 5000)
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
    await enterMuseum({ kind: (params.get('avatar') as AvatarKind) || saved.kind || 'oraculo', name: params.get('name') || saved.name || L('Visitante', 'Visitor') })
    handleHash()
    return
  }
  const route = location.hash
  if (route === '#/museo') {
    const saved = JSON.parse(localStorage.getItem('cm.profile') || '{}')
    if (saved.kind) {
      document.body.classList.remove('landing-mode')
      await enterMuseum(saved)
      return
    }
  }
  const it = intro(ui)
  let p = 0
  const iv = setInterval(() => it.progress((p = Math.min(0.95, p + 0.12))), 180)
  await document.fonts?.ready
  await new Promise((r) => setTimeout(r, 400))
  clearInterval(iv)
  await it.done()
  if (location.hash === '#admin') return handleHash()
  if (route === '#/personajes' || route === '#/museo') {
    document.body.classList.remove('landing-mode')
    mode = 'museum'
    const profile = await selectCharacter(ui)
    await cinematic()
    return enterMuseum(profile)
  }
  landing(ui, (v) => (landingP = v), async () => {
    mode = 'museum'
    const profile = await selectCharacter(ui)
    if (!params.has('nocine')) await cinematic()
    await enterMuseum(profile)
  })
}
boot()

// test / debug handle
Object.assign(window, {
  __cm: {
    get controller() {
      return controller
    },
    get state() {
      return { mode, room: controller?.room, x: controller?.x, z: controller?.z, y: controller?.y, energy, fps: engine.fps, peers: peers.size, me }
    },
    place,
    pay: (amount = 100, payer = 'Test') => payments.ingest(payments.make(amount, L('Donación simulada', 'Simulated donation'), 'donacion', payer, 'sim')),
    look: (yaw: number, pitch = 0.28) => controller && ((controller.camYaw = yaw), (controller.camPitch = pitch), controller.snapCamera()),
    walk: (code: string, ms = 1000) => {
      controller?.keys.add(code)
      setTimeout(() => controller?.keys.delete(code), ms)
    },
    act: () => nearest?.action(),
    view: (p: number[] | null, l: number[] = [0, 10, 0]) => (viewHold = p ? [new THREE.Vector3(...p), new THREE.Vector3(...l)] : null),
    engine,
  },
})
