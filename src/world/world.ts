import { buildExterior } from './exterior'
import { L, tx } from '../core/i18n'
import * as THREE from 'three'
import type { Content, RoomId } from '../content/types'
import type { PaymentEvent } from '../payments/bus'
import { Nav } from './nav'
import { CORRIDOR_END, WING_DEFS, buildLobby, makeWing, type Interactable, type Wing } from './building'
import { buildRoom, tickShop, type Hooks, type RoomRuntime } from './rooms'
import { buildSpaces, textPanel, type SpaceHooks } from './spaces'
import { buildExtras, type ExtraHooks } from './extras'

export interface World {
  group: THREE.Group
  nav: Nav
  interactables: Interactable[]
  wings: Wing[]
  spawn(room: RoomId): { x: number; z: number; yaw: number }
  hallName(id?: string): string | null
  forumSpawn(): { x: number; z: number; yaw: number }
  juntasSpawn(): { x: number; z: number; yaw: number }
  tick(dt: number, t: number, here: RoomId, cinematic?: boolean, hallId?: string): void
  addPlant(p: PaymentEvent, fresh: boolean): void
  chandeliers: THREE.Group[]
  title: THREE.Object3D
  dispose(): void
}

export function buildWorld(c: Content, hooks: Hooks & SpaceHooks & ExtraHooks): World {
  const group = new THREE.Group()
  const nav = new Nav()
  const interactables: Interactable[] = []
  const add = (i: Interactable) => interactables.push(i)
  // wing corridors and rooms are registered before the lobby so ramps take priority
  const wings: Wing[] = []
  const runtimes: RoomRuntime[] = []
  for (const def of WING_DEFS) {
    const info = c.rooms[def.room]
    const open = def.room === 'futuro' ? c.settings.futureOpen : info.open
    const w = makeWing(group, nav, def, open)
    wings.push(w)
  }
  const lobby = buildLobby(group, nav, c)
  const exteriorGroup = new THREE.Group()
  exteriorGroup.name = 'exterior'
  group.add(exteriorGroup)
  const exterior = buildExterior(exteriorGroup, wings)
  const spaces = buildSpaces(group, nav, c, wings, add, hooks)
  const extras = buildExtras(group, nav, c, wings, add, hooks)
  for (const w of wings) if (w.open) runtimes.push(buildRoom(w, c, add, hooks))
  for (const [x, title, body, col, act] of [
    [7, L('Convocatorias', 'Open calls'), L('Lee los términos y postúlate', 'Read the terms and apply'), '#ff9be9', () => hooks.openCalls()],
    [-7, tx(c.about, 'title'), L('Ethercoded · la historia del museo', 'Ethercoded · the museum story'), '#8fb4ff', () => hooks.openAbout()],
  ] as const) {
    const k = textPanel(title, body, 2.4, 1.1, col)
    k.position.set(x, 2.1, 0)
    k.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2
    const back = k.clone()
    back.rotation.y += Math.PI
    back.position.x += x > 0 ? 0.02 : -0.02
    lobby.group.add(k, back)
    add({ id: 'kiosk' + x, pos: new THREE.Vector3(x > 0 ? x - 1.4 : x + 1.4, 0, 0), r: 2, label: title, room: 'lobby', action: act })
  }
  add({ id: 'altar', pos: new THREE.Vector3(0, 0, 4.6), r: 2.2, label: L('Ofrenda · encender la nube', 'Offering · light the cloud'), room: 'lobby', action: () => hooks.donate() })
  add({ id: 'events', pos: new THREE.Vector3(0, 0, -4.6), r: 2.2, label: L('Agenda de eventos', 'Events calendar'), room: 'lobby', action: () => hooks.openEvents() })
  const garden = runtimes.find((r) => r.addPlant)
  return {
    group,
    nav,
    interactables,
    wings,
    chandeliers: lobby.chandeliers,
    title: lobby.title,
    hallName: spaces.hallName,
    forumSpawn: extras.forumSpawn,
    juntasSpawn: extras.juntasSpawn,
    spawn(room) {
      if (room === 'lobby') return { x: 0, z: 17, yaw: 0 }
      const w = wings.find((x) => x.room === room)
      if (!w) return { x: 0, z: 17, yaw: 0 }
      const p = w.world(0, room === 'jardin' ? -CORRIDOR_END - 8 : -CORRIDOR_END - 9)
      const free = nav.freePoint(p.x, p.z)
      return { x: free?.x ?? p.x, z: free?.z ?? p.z, yaw: (w.k * Math.PI) / 4 }
    },
    tick(dt, t, here, cinematic = false, hallId) {
      exterior.tick(t)
      spaces.tick(dt, t)
      extras.tick(t)
      tickShop(t)
      for (const r of runtimes) r.tick(dt, t, here)
      const showAll = cinematic
      const showGarden = here === 'jardin' || here === 'foro'
      lobby.group.visible = showAll || here !== 'salas'
      for (const w of wings) {
        const selected = here === w.room
        const showShell = showAll || here === 'lobby' || selected || (showGarden && w.room === 'jardin')
        w.corridorGroup.visible = showShell
        w.shellGroup.visible = showShell
        w.group.visible = showAll || selected || (showGarden && w.room === 'jardin')
      }
      for (const [id, hall] of spaces.groups) hall.visible = showAll || (here === 'salas' && id === hallId)
      if (extras.forumGroup) extras.forumGroup.visible = showAll || showGarden
      extras.juntasGroup.visible = showAll || here === 'juntas'
      exteriorGroup.visible = showAll || showGarden
    },
    addPlant(p, fresh) {
      garden?.addPlant?.(p, fresh)
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
    },
  }
}
