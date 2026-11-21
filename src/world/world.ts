import { buildExterior } from './exterior'
import { L, tx } from '../core/i18n'
import * as THREE from 'three'
import type { Content, RoomId } from '../content/types'
import type { PaymentEvent } from '../payments/bus'
import { Nav } from './nav'
import { CORRIDOR_END, WING_DEFS, buildLobby, makeWing, type Interactable, type Wing } from './building'
import { buildRoom, type Hooks, type RoomRuntime } from './rooms'
import { buildSpaces, textPanel, type SpaceHooks } from './spaces'

export interface World {
  group: THREE.Group
  nav: Nav
  interactables: Interactable[]
  wings: Wing[]
  spawn(room: RoomId): { x: number; z: number; yaw: number }
  hallName(id?: string): string | null
  tick(dt: number, t: number, here: RoomId): void
  addPlant(p: PaymentEvent, fresh: boolean): void
  chandeliers: THREE.Group[]
  title: THREE.Object3D
  dispose(): void
}

export function buildWorld(c: Content, hooks: Hooks & SpaceHooks): World {
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
    if (open) runtimes.push(buildRoom(w, c, add, hooks))
  }
  const lobby = buildLobby(group, nav, c)
  const exterior = buildExterior(group, wings)
  const spaces = buildSpaces(group, nav, c, wings, add, hooks)
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
    group.add(k, back)
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
    spawn(room) {
      if (room === 'lobby') return { x: 0, z: 17, yaw: 0 }
      const w = wings.find((x) => x.room === room)
      if (!w) return { x: 0, z: 17, yaw: 0 }
      const p = w.world(0, room === 'jardin' ? -CORRIDOR_END - 8 : -CORRIDOR_END - 3)
      return { x: p.x, z: p.z, yaw: (w.k * Math.PI) / 4 }
    },
    tick(dt, t, here) {
      exterior.tick(t)
      spaces.tick(dt, t)
      for (const r of runtimes) r.tick(dt, t, here)
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
