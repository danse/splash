import { Brawler, BrawlerControl } from './brawler'
import { Rect, circleRectCollide } from '../world/collision'
import { clamp, dist, rand, TAU } from '../core/math'

const BRAWLER_IDS = ['blaster', 'charger', 'tank']

export function randomBrawlerId(): string {
  return BRAWLER_IDS[Math.floor(Math.random() * BRAWLER_IDS.length)]
}

export class BotBrain {
  wanderTarget = { x: 0, y: 0 }
  wanderTimer = 0
  wobble = 0
  private rngA = Math.random()
  private rngB = Math.random()
  private nextJitter = 0

  constructor(x: number, y: number) {
    this.wanderTarget.x = x
    this.wanderTarget.y = y
  }

  think(
    self: Brawler,
    all: Brawler[],
    walls: Rect[],
    dt: number,
    time: number,
  ): BrawlerControl {
    let target: Brawler | null = null
    let best = Infinity
    for (const b of all) {
      if (b === self || !b.alive) continue
      const d = dist(self.pos.x, self.pos.y, b.pos.x, b.pos.y)
      if (d < best) {
        best = d
        target = b
      }
    }

    this.wanderTimer -= dt
    if (!target || this.wanderTimer <= 0) {
      if (this.wanderTimer <= 0) {
        this.wanderTarget = {
          x: rand(140, 2260),
          y: rand(140, 2260),
        }
        this.wanderTimer = rand(2, 4.5)
      }
    }

    let moveX = 0
    let moveY = 0
    let firing = false
    let superQueued = false
    let aimAngle = self.facing

    const myDef = self.def
    const desiredRange = myDef.superType === 'dash' ? 170 : 240
    const lowHp = self.hp / self.maxHp < 0.28

    if (target) {
      const dx = target.pos.x - self.pos.x
      const dy = target.pos.y - self.pos.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const nx = dx / d
      const ny = dy / d

      this.nextJitter -= dt
      if (this.nextJitter <= 0) {
        this.wobble = rand(-0.09, 0.09)
        this.nextJitter = rand(0.12, 0.3)
      }
      aimAngle = Math.atan2(dy, dx) + this.wobble

      let radial = 0
      let strafe = 0
      if (lowHp) {
        radial = -1
      } else if (d > desiredRange) {
        radial = 1
      } else if (d < desiredRange * 0.55) {
        radial = -0.5
      }

      strafe = d < myDef.projectileRange * 0.8 ? 0.7 : 0.25

      const side = (Math.sin(time * 0.7 + this.rngA * TAU) > 0 ? 1 : -1)
      const sx = -ny * side * strafe
      const sy = nx * side * strafe
      moveX = nx * radial + sx
      moveY = ny * radial + sy

      const inRange = d < myDef.projectileRange * 0.9
      const cooldownReady = self.fireCd <= 0
      if (inRange && cooldownReady) firing = true

      if (self.superReady) {
        if (myDef.superType === 'dash' && d < 320) superQueued = true
        if (myDef.superType === 'storm' && d < myDef.projectileRange * 0.8) superQueued = true
        if (myDef.superType === 'boulder' && d < 700) superQueued = true
      }
    } else {
      const dx = this.wanderTarget.x - self.pos.x
      const dy = this.wanderTarget.y - self.pos.y
      const d = Math.hypot(dx, dy)
      if (d > 40) {
        moveX = dx / d
        moveY = dy / d
      }
    }

    const len = Math.hypot(moveX, moveY)
    if (len > 1) {
      moveX /= len
      moveY /= len
    }
    const mag = Math.min(1, len)

    const dirX = moveX
    const dirY = moveY
    if (dirX !== 0 || dirY !== 0) {
      if (this.blocked(self, walls, dirX, dirY)) {
        const perpX = -dirY
        const perpY = dirX
        if (this.blocked(self, walls, perpX, perpY)) {
          moveX = -dirX
          moveY = -dirY
        } else {
          moveX = perpX
          moveY = perpY
        }
      }
    }

    this.rngB += 0.001
    return {
      moveX,
      moveY,
      moveMag: clamp(mag, 0, 1),
      aimAngle,
      firing,
      superQueued,
    }
  }

  private blocked(self: Brawler, walls: Rect[], dx: number, dy: number): boolean {
    const probe = { x: self.pos.x + dx * (self.r + 26), y: self.pos.y + dy * (self.r + 26), r: self.r * 0.8 }
    for (const w of walls) {
      if (circleRectCollide(probe, w)) return true
    }
    return false
  }
}
