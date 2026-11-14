import type { RoomId } from '../content/types'

export interface Region {
  kind: 'rect' | 'circle'
  cx: number
  cz: number
  ang: number
  hw: number
  hl: number
  r: number
  y0: number
  y1: number
  room: RoomId
  name?: string
}

export interface Obstacle {
  x: number
  z: number
  r: number
}

export class Nav {
  regions: Region[] = []
  obstacles: Obstacle[] = []

  rect(room: RoomId, cx: number, cz: number, ang: number, hw: number, hl: number, y0 = 0, y1 = y0, name?: string) {
    this.regions.push({ kind: 'rect', cx, cz, ang, hw, hl, r: 0, y0, y1, room, name })
  }
  circle(room: RoomId, cx: number, cz: number, r: number, y = 0, name?: string) {
    this.regions.push({ kind: 'circle', cx, cz, ang: 0, hw: 0, hl: 0, r, y0: y, y1: y, room, name })
  }
  obstacle(x: number, z: number, r: number) {
    this.obstacles.push({ x, z, r })
  }

  private local(rg: Region, x: number, z: number) {
    const dx = x - rg.cx
    const dz = z - rg.cz
    const c = Math.cos(rg.ang)
    const s = Math.sin(rg.ang)
    return { lx: dx * c - dz * s, lz: dx * s + dz * c }
  }

  find(x: number, z: number, margin = 0.35): Region | null {
    for (const rg of this.regions) {
      if (rg.kind === 'circle') {
        const dx = x - rg.cx
        const dz = z - rg.cz
        if (dx * dx + dz * dz <= (rg.r - margin) ** 2) return rg
      } else {
        const { lx, lz } = this.local(rg, x, z)
        if (Math.abs(lx) <= rg.hw - margin && Math.abs(lz) <= rg.hl) return rg
      }
    }
    return null
  }

  heightIn(rg: Region, x: number, z: number) {
    if (rg.y0 === rg.y1) return rg.y0
    const { lz } = this.local(rg, x, z)
    // y0 at +hl (inner end), y1 at -hl (outer end)
    const t = Math.min(1, Math.max(0, (rg.hl - lz) / (2 * rg.hl)))
    return rg.y0 + (rg.y1 - rg.y0) * t
  }

  walkable(x: number, z: number, radius = 0.35) {
    const rg = this.find(x, z, radius)
    if (!rg) return null
    for (const o of this.obstacles) {
      const dx = x - o.x
      const dz = z - o.z
      if (dx * dx + dz * dz < (o.r + radius) ** 2) return null
    }
    return rg
  }

  /** Slides a move along walls. Returns the new position (y = floor height). */
  move(x: number, z: number, dx: number, dz: number, radius = 0.35) {
    let rg = this.walkable(x + dx, z + dz, radius)
    if (rg) return { x: x + dx, z: z + dz, y: this.heightIn(rg, x + dx, z + dz), room: rg.room, ok: true }
    rg = this.walkable(x + dx, z, radius)
    if (rg) return { x: x + dx, z, y: this.heightIn(rg, x + dx, z), room: rg.room, ok: true }
    rg = this.walkable(x, z + dz, radius)
    if (rg) return { x, z: z + dz, y: this.heightIn(rg, x, z + dz), room: rg.room, ok: true }
    rg = this.find(x, z, 0)
    return { x, z, y: rg ? this.heightIn(rg, x, z) : 0, room: rg?.room ?? 'lobby', ok: false }
  }
}
