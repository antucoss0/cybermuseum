import * as THREE from 'three'
import { L, tx } from '../core/i18n'
import type { Content } from '../content/types'
import { M } from './materials'
import { P } from './pbr'
import { column } from './gothic'
import { CORRIDOR_END, type Interactable, type Wing } from './building'
import type { Nav } from './nav'
import { portalDoor, textPanel } from './spaces'

export const JUNTAS = new THREE.Vector3(-600, 0, 0)

export interface ExtraHooks {
  openForum(): void
  voice(): void
  goto(target: { x: number; z: number; yaw: number }, title: string, kicker: string): void
}

/** Amphitheater + dancefloor behind the garden, and the private meeting chamber. */
export function buildExtras(root: THREE.Group, nav: Nav, c: Content, wings: Wing[], add: (i: Interactable) => void, hooks: ExtraHooks) {
  const ticks: ((t: number) => void)[] = []
  const gw = wings.find((w) => w.room === 'jardin')
  let forumSpawn = { x: 0, z: 0, yaw: 0 }
  let forumGroup: THREE.Group | null = null
  if (gw) {
    const gz = -CORRIDOR_END - 22
    const approachZ = gz - 35
    gw.rect(0, approachZ, 2.2, 15)
    const path = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 30), P.stoneCarved)
    path.position.set(0, -0.15, approachZ)
    gw.group.add(path)
    const hedgeRows = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.75, 1.1, 4.2),
      new THREE.MeshStandardMaterial({ color: '#1d2e20', roughness: 0.96 }),
      12,
    )
    const hedgeTransform = new THREE.Object3D()
    let hedgeIndex = 0
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const z = gz - 21 - i * 4.2
        hedgeTransform.position.set(side * 3.15, 0.55, z)
        hedgeTransform.updateMatrix()
        hedgeRows.setMatrixAt(hedgeIndex++, hedgeTransform.matrix)
        gw.obstacle(side * 3.15, z, 0.95)
      }
    }
    hedgeRows.instanceMatrix.needsUpdate = true
    hedgeRows.frustumCulled = true
    hedgeRows.computeBoundingSphere()
    gw.group.add(hedgeRows)
    const ctr = gw.world(0, gz - 45)
    const ang = (gw.k * Math.PI) / 4
    const g = new THREE.Group()
    g.name = 'foro'
    forumGroup = g
    g.position.copy(ctr)
    g.rotation.y = -ang
    root.add(g)
    nav.circle('foro', ctr.x, ctr.z, 17, 0, 'forum')
    const base = new THREE.Mesh(new THREE.CylinderGeometry(19, 12, 6, 48), M.stone)
    base.position.y = -3.01
    g.add(base)
    const forumMarble = P.marbleBlack.clone()
    forumMarble.color.set('#171321')
    const seatingStone = P.stoneCarved.clone()
    seatingStone.color.set('#625b70')
    const seatingRiser = M.stone.clone()
    seatingRiser.color.set('#282334')
    const forumGold = P.gold.clone()
    forumGold.color.set('#94703a')
    forumGold.emissive.set('#110b03')
    forumGold.emissiveIntensity = 0.06
    forumGold.roughness = 0.48
    forumGold.metalness = 0.75
    const floor = new THREE.Mesh(new THREE.CircleGeometry(18.5, 64), forumMarble)
    floor.rotation.x = -Math.PI / 2
    g.add(floor)
    // stepped seating arcs facing the stage (stage sits on the far side, local -z)
    for (let r = 0; r < 5; r++) {
      const rad = 9 + r * 1.8
      const tier = new THREE.Mesh(new THREE.RingGeometry(rad, rad + 1.8, 48, 1, Math.PI * 0.05, Math.PI * 0.9), seatingStone)
      tier.rotation.x = -Math.PI / 2
      tier.position.set(0, 0.35 + r * 0.35, -4)
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(rad + 1.8, rad + 1.8, 0.38, 48, 1, true, Math.PI * 0.05, Math.PI * 0.9), seatingRiser)
      riser.position.set(0, 0.16 + r * 0.35, -4)
      g.add(tier, riser)
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(rad, 0.012, 4, 48, Math.PI * 0.9),
        forumGold,
      )
      lip.rotation.set(-Math.PI / 2, 0, Math.PI * 0.05)
      lip.position.set(0, 0.38 + r * 0.35, -4)
      g.add(lip)
    }
    const df = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), forumMarble)
    df.rotation.x = -Math.PI / 2
    df.position.set(0, 0.02, 1)
    g.add(df)
    const danceInlay = new THREE.Mesh(new THREE.TorusGeometry(6.3, 0.025, 5, 72), forumGold)
    danceInlay.rotation.x = Math.PI / 2
    danceInlay.position.set(0, 0.045, 1)
    g.add(danceInlay)
    // stage
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 1, 48, 1, false, Math.PI / 2, Math.PI), M.obsidian)
    stage.position.set(0, 0.5, 9.5)
    stage.rotation.y = Math.PI
    const stageTop = new THREE.Mesh(new THREE.CircleGeometry(5.8, 64), forumMarble)
    stageTop.rotation.x = -Math.PI / 2
    stageTop.position.set(0, 1.01, 9.5)
    const stageInlay = new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.035, 5, 72), forumGold)
    stageInlay.rotation.x = Math.PI / 2
    stageInlay.position.set(0, 1.04, 9.5)
    g.add(stage, stageTop, stageInlay)
    nav.obstacle(ctr.x + Math.sin(ang) * -9.5, ctr.z + Math.cos(ang) * -9.5, 5.5)
    for (const s of [-1, 1]) {
      const col = column(9, 0.35)
      col.position.set(s * 5.5, 1, 11)
      g.add(col)
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const col = column(9, 0.42)
      col.position.set(Math.cos(a) * 16.4, 0, Math.sin(a) * 16.4)
      g.add(col)
    }
    const next = c.forum.filter((e) => e.visible).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
    const screen = textPanel(next ? tx(next, 'title') : L('Foro Cyber Museum', 'Cyber Museum Forum'), next ? `${next.date} · ${next.time} · ${next.kind}\n${tx(next, 'description')}` : L('Pronto: conciertos, DJs y fiestas.', 'Soon: concerts, DJs and parties.'), 9, 4, '#ff9be9', L('Próximo evento', 'Next event'))
    screen.position.set(0, 6, 11.5)
    screen.rotation.y = Math.PI
    g.add(screen)
    const lasers: THREE.Mesh[] = []
    const laserMat = new THREE.MeshBasicMaterial({ color: '#b89cff', toneMapped: false, transparent: true, opacity: 0.38 })
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 30, 5), laserMat)
      b.position.set(-3 + i * 3, 1.5, 10)
      g.add(b)
      lasers.push(b)
    }
    ticks.push((t) => lasers.forEach((b, i) => b.rotation.set(Math.sin(t * 0.8 + i) * 0.9, 0, Math.cos(t * 0.6 + i * 2) * 0.9 + 0.3)))
    const spot = new THREE.PointLight('#ff6fe0', 30, 30, 1.5)
    spot.position.set(0, 6, 6)
    g.add(spot)
    ticks.push((t) => (spot.color.setHSL((t * 0.05) % 1, 0.8, 0.6), (spot.intensity = 12 + Math.sin(t * 8) * 3)))
    const stagePos = ctr.clone().add(new THREE.Vector3(Math.sin(-ang) * 6, 0, Math.cos(-ang) * 6).multiplyScalar(-1))
    void stagePos
    const ip = new THREE.Vector3(0, 0, 4).applyAxisAngle(new THREE.Vector3(0, 1, 0), -ang).add(ctr)
    add({ id: 'forum', pos: ip, r: 2.4, label: L('Foro · programa de eventos', 'Forum · events programme'), room: 'foro', action: () => hooks.openForum() })
    const sp = new THREE.Vector3(0, 0, -12).applyAxisAngle(new THREE.Vector3(0, 1, 0), -ang).add(ctr)
    forumSpawn = { x: sp.x, z: sp.z, yaw: ang + Math.PI }
  }

  // --- private meeting chamber (no public door) ---
  const j = new THREE.Group()
  j.name = 'juntas'
  j.position.copy(JUNTAS)
  root.add(j)
  nav.rect('juntas', JUNTAS.x, JUNTAS.z, 0, 7, 6, 0, 0, 'juntas')
  const jf = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshStandardMaterial({ color: '#141020', roughness: 0.3, metalness: 0.5 }))
  jf.rotation.x = -Math.PI / 2
  j.add(jf)
  const wallM = new THREE.MeshStandardMaterial({ color: '#100d1a', roughness: 0.8 })
  for (const [x, z, w, d] of [[0, -6.2, 14.8, 0.4], [0, 6.2, 14.8, 0.4], [-7.2, 0, 0.4, 12], [7.2, 0, 0.4, 12]] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), wallM)
    wall.position.set(x, 2.5, z)
    j.add(wall)
  }
  const table = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 48), new THREE.MeshPhysicalMaterial({ color: '#1b1430', roughness: 0.1, metalness: 0.2, clearcoat: 1 }))
  table.position.y = 0.78
  const tring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.01, 4, 64),
    new THREE.MeshBasicMaterial({ color: '#c9a86a', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
  )
  tring.rotation.x = Math.PI / 2
  tring.position.y = 0.85
  j.add(table, tring)
  nav.obstacle(JUNTAS.x, JUNTAS.z, 2.8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), M.obsidian)
    ch.position.set(Math.cos(a) * 3.2, 0.5, Math.sin(a) * 3.2)
    j.add(ch)
  }
  const holo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshBasicMaterial({ color: '#b89cff', wireframe: true, toneMapped: false }))
  holo.position.y = 1.8
  j.add(holo, new THREE.PointLight('#b89cff', 14, 0, 1.6).translateY(3.5))
  ticks.push((t) => (holo.rotation.y = t * 0.4))
  const sign = textPanel(L('Sala de juntas', 'Meeting room'), L('Privada · hasta 8 personas · voz y chat', 'Private · up to 8 people · voice and chat'), 4, 1.2, '#b89cff')
  sign.position.set(0, 3, -5.98)
  j.add(sign)
  const exit = portalDoor('#b89cff', 1.8, 3)
  exit.position.set(0, 0, 5.9)
  exit.rotation.y = Math.PI
  j.add(exit)
  add({ id: 'mic', pos: new THREE.Vector3(JUNTAS.x, 0, JUNTAS.z - 4.4), r: 1.8, label: L('Activar / silenciar micrófono', 'Toggle microphone'), room: 'juntas', action: () => hooks.voice() })
  add({ id: 'juntas-exit', pos: new THREE.Vector3(JUNTAS.x, 0, JUNTAS.z + 4.6), r: 1.6, label: L('Salir al lobby', 'Exit to lobby'), room: 'juntas', action: () => hooks.goto({ x: 0, z: 9, yaw: 0 }, 'Lobby', L('Regresando a', 'Back to')) })

  return {
    forumGroup,
    juntasGroup: j,
    forumSpawn: () => forumSpawn,
    juntasSpawn: () => ({ x: JUNTAS.x, z: JUNTAS.z + 4, yaw: 0 }),
    tick: (t: number) => ticks.forEach((f) => f(t)),
  }
}
