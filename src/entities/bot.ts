import { Brawler, BrawlerControl, BRAWLER_DEFS } from './brawler'
import { Rect, circleRectCollide } from '../world/collision'
import { clamp, dist, rand, TAU } from '../core/math'

const BRAWLER_IDS = Object.keys(BRAWLER_DEFS)

export function randomBrawlerId(): string {
  return BRAWLER_IDS[Math.floor(Math.random() * BRAWLER_IDS.length)]
}

export interface BrainOpts {
  turret?: boolean
  noSuper?: boolean
  noRetreat?: boolean
  perfectAim?: boolean
  aimWobble?: number
  aimJitter?: [number, number]
  speedMult?: number
  burstOn?: number
  burstOff?: number
  engageDelay?: number
}

export class BotBrain {
  wanderTarget = { x: 0, y: 0 }
  wanderTimer = 0
  wobble = 0
  preferredTarget: Brawler | null = null
  stationary = false
  private rngA = Math.random()
  private rngB = Math.random()
  private nextJitter = 0
  private opts: BrainOpts
  private burstTimer = 0
  private burstFiring = true
  private engageTimer = 0
  private arenaW = 2400
  private arenaH = 2400

  constructor(x: number, y: number, opts: BrainOpts = {}) {
    this.wanderTarget.x = x
    this.wanderTarget.y = y
    this.opts = opts
    this.burstTimer = opts.burstOn ?? Infinity
    this.engageTimer = opts.engageDelay ?? 0
  }

  setArenaBounds(w: number, h: number): void {
    this.arenaW = w
    this.arenaH = h
  }

  private pickTarget(self: Brawler, all: Brawler[], dt: number): Brawler | null {
    if (this.engageTimer > 0) {
      this.engageTimer -= dt
      return null
    }
    if (this.preferredTarget && this.preferredTarget.alive) {
      return this.preferredTarget
    }
    let best: Brawler | null = null
    let bestD = Infinity
    for (const b of all) {
      if (b === self || !b.alive) continue
      const d = dist(self.pos.x, self.pos.y, b.pos.x, b.pos.y)
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    return best
  }

  think(
    self: Brawler,
    all: Brawler[],
    walls: Rect[],
    dt: number,
    time: number,
  ): BrawlerControl {
    const target = this.pickTarget(self, all, dt)
    const ctrl = this.computeMovement(self, target, walls, time, dt)

    return {
      moveX: ctrl.moveX,
      moveY: ctrl.moveY,
      moveMag: ctrl.moveMag,
      aimAngle: ctrl.aimAngle,
      firing: ctrl.firing,
      superQueued: ctrl.superQueued,
    }
  }

  private computeMovement(
    self: Brawler,
    target: Brawler | null,
    walls: Rect[],
    time: number,
    dt: number,
  ): { moveX: number; moveY: number; moveMag: number; firing: boolean; superQueued: boolean; aimAngle: number } {

    this.wanderTimer -= dt
    if (this.wanderTimer <= 0) {
      this.wanderTarget = {
        x: rand(140, this.arenaW - 140),
        y: rand(140, this.arenaH - 140),
      }
      this.wanderTimer = rand(2, 4.5)
    }

    let moveX = 0
    let moveY = 0
    let firing = false
    let superQueued = false
    let aimAngle = self.facing

    const myDef = self.def
    const atkRange = myDef.melee ? (myDef.meleeRange ?? 120) : myDef.projectileRange
    const desiredRange = myDef.melee ? atkRange * 0.95 : myDef.superType === 'dash' ? 170 : 240
    const lowHp = self.hp / self.maxHp < 0.28

    if (target) {
      const dx = target.pos.x - self.pos.x
      const dy = target.pos.y - self.pos.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const nx = dx / d
      const ny = dy / d

      if (!this.opts.perfectAim) {
        this.nextJitter -= dt
        if (this.nextJitter <= 0) {
          this.wobble = rand(-(this.opts.aimWobble ?? 0.09), this.opts.aimWobble ?? 0.09)
          this.nextJitter = rand(this.opts.aimJitter?.[0] ?? 0.12, this.opts.aimJitter?.[1] ?? 0.3)
        }
      }
      aimAngle = Math.atan2(dy, dx) + (this.opts.perfectAim ? 0 : this.wobble)

      let radial = 0
      let strafe = 0
      if (lowHp && !this.opts.noRetreat) {
        radial = -1
      } else if (d > desiredRange) {
        radial = 1
      } else if (d < desiredRange * 0.55) {
        radial = -0.5
      }

      strafe = myDef.melee ? 0.3 : d < atkRange * 0.8 ? 0.7 : 0.25

      const side = (Math.sin(time * 0.7 + this.rngA * TAU) > 0 ? 1 : -1)
      const sx = -ny * side * strafe
      const sy = nx * side * strafe
      moveX = nx * radial + sx
      moveY = ny * radial + sy

      const inRange = d < atkRange * 0.9
      const cooldownReady = self.fireCd <= 0
      this.burstTimer -= dt
      if (this.burstTimer <= 0) {
        this.burstFiring = !this.burstFiring
        this.burstTimer = this.burstFiring ? (this.opts.burstOn ?? Infinity) : (this.opts.burstOff ?? 0)
      }
      if (inRange && cooldownReady && this.burstFiring) firing = true

      if (!this.opts.noSuper && self.superReady) {
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

    if (this.stationary || this.opts.turret) {
      moveX = 0
      moveY = 0
      superQueued = false
    }

    const len = Math.hypot(moveX, moveY)
    if (len > 1) {
      moveX /= len
      moveY /= len
    }
    const mult = this.opts.speedMult ?? 1
    moveX *= mult
    moveY *= mult
    const mag = Math.min(1, len * mult)

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
