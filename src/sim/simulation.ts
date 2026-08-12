import { FX } from '../fx/particles'
import { Brawler, BRAWLER_DEFS, BrawlerControl } from '../entities/brawler'
import { BotBrain, type BrainOpts } from '../entities/bot'
import { Projectile, spawnProjectile } from '../entities/projectile'
import { Pickup, makePickup } from '../entities/pickup'
import { generateArena, Arena } from '../world/arena'
import { resolveCircle, circleRectCollide } from '../world/collision'
import { sfx } from '../audio'
import { dist2, dist, clamp, rand, TAU } from '../core/math'
import { EndGate } from '../core/endGate'

export type SimPhase = 'countdown' | 'playing' | 'ended'

export interface SimConfig {
  attackers: number
  respawn: boolean
  timer: boolean
  endMatch: boolean
  endOnLastDeath: boolean
  duration: number
  countdown: number
  endDelay: number
  focusPlayer: boolean
  dummyBots: boolean
  spawnCount: number
  modeId: string
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  attackers: 0,
  respawn: false,
  timer: false,
  endMatch: true,
  endOnLastDeath: false,
  duration: 120,
  countdown: 3.4,
  endDelay: 1.8,
  focusPlayer: false,
  dummyBots: false,
  spawnCount: 8,
  modeId: 'sim',
}

export interface SimEvents {
  fire?: (b: Brawler, kind: 'shot' | 'swing' | 'super', time: number) => void
  hit?: (attacker: Brawler, target: Brawler, dmg: number, time: number) => void
  super?: (b: Brawler, time: number) => void
  death?: (dead: Brawler, killer: Brawler | null, time: number) => void
  respawn?: (b: Brawler) => void
  pickup?: (b: Brawler, kind: 'power' | 'heal') => void
}

export interface SimResult {
  time: number
  survivors: Brawler[]
}

const idleControl = (p: Brawler): BrawlerControl => ({
  moveX: 0,
  moveY: 0,
  moveMag: 0,
  aimAngle: p.facing,
  firing: false,
  superQueued: false,
})

export class Simulation {
  arena!: Arena
  brawlers: Brawler[] = []
  bots: Brawler[] = []
  player: Brawler | null = null
  projectiles: Projectile[] = []
  pickups: Pickup[] = []
  time = 0
  phase: SimPhase = 'countdown'
  cfg: SimConfig
  fx = new FX()
  events: SimEvents = {}
  onStep: ((dt: number) => void) | null = null
  onEnd: ((r: SimResult) => void) | null = null

  brains = new Map<Brawler, BotBrain>()
  private powerUntil = new Map<Brawler, number>()
  private respawnQueue = new Map<Brawler, { x: number; y: number; timer: number }>()
  private spawnPoints = new Map<Brawler, { x: number; y: number }>()
  private endGate = new EndGate(0)
  private countdown = 0
  private brainSlots = 0

  constructor(seed: number, cfg: Partial<SimConfig> = {}) {
    this.cfg = { ...DEFAULT_SIM_CONFIG, ...cfg }
    this.arena = generateArena(seed, this.cfg.spawnCount)
    this.countdown = this.cfg.countdown
    this.endGate = new EndGate(this.cfg.endDelay)
  }

  private nextSpawn(index: number): { x: number; y: number } {
    const p = this.arena.spawnPoints[index]
    return p ? { x: p.x, y: p.y } : { x: this.arena.width / 2, y: this.arena.height / 2 }
  }

  addBot(defId: string, x?: number, y?: number, brainOpts?: BrainOpts): Brawler {
    const spawn = this.nextSpawn(this.brawlers.length)
    const bx = x ?? spawn.x
    const by = y ?? spawn.y
    const bot = new Brawler(BRAWLER_DEFS[defId], bx, by)
    this.bots.push(bot)
    this.brawlers.push(bot)
    this.spawnPoints.set(bot, { x: bx, y: by })
    if (this.brainSlots < this.cfg.attackers) {
      const brain = new BotBrain(bx, by, brainOpts)
      brain.stationary = this.cfg.dummyBots
      if (this.cfg.focusPlayer && this.player) brain.preferredTarget = this.player
      this.brains.set(bot, brain)
      this.brainSlots++
    }
    return bot
  }

  addPlayer(defId: string, x?: number, y?: number): Brawler {
    const spawn = this.nextSpawn(this.brawlers.length)
    const px = x ?? spawn.x
    const py = y ?? spawn.y
    const p = new Brawler(BRAWLER_DEFS[defId], px, py)
    p.isPlayer = true
    this.player = p
    this.brawlers.push(p)
    this.spawnPoints.set(p, { x: px, y: py })
    return p
  }

  addDefaultPickups(): void {
    const center = this.arena.powerSpots
    this.pickups.push(makePickup(center[0].x, center[0].y, 'power', 1))
    this.pickups.push(makePickup(center[1].x, center[1].y, 'heal', 2600))
    this.pickups.push(makePickup(center[2].x, center[2].y, 'power', 1))
    this.pickups.push(makePickup(center[3].x, center[3].y, 'heal', 2600))
    for (let i = 0; i < 3; i++) {
      this.pickups.push(
        makePickup(rand(200, this.arena.width - 200), rand(200, this.arena.height - 200), 'heal', 2000),
      )
    }
  }

  closestEnemy(from: Brawler): Brawler | null {
    let best: Brawler | null = null
    let bestD = Infinity
    for (const b of this.brawlers) {
      if (b === from || !b.alive) continue
      const d = dist(from.pos.x, from.pos.y, b.pos.x, b.pos.y)
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    return best
  }

  step(dt: number, playerControl?: () => BrawlerControl): void {
    if (this.phase === 'countdown') {
      this.countdown -= dt
      this.updateBrains(dt, playerControl)
      this.moveBrawlers()
      this.fx.update(dt)
      if (this.countdown <= 0) {
        this.phase = 'playing'
        sfx.ready()
      }
    } else if (this.phase === 'playing') {
      this.time += dt
      this.updateBrains(dt, playerControl)
      this.moveBrawlers()
      this.fireLogic()
      this.updateProjectiles(dt)
      this.updatePickups(dt)
      this.handleDashDamage()
      this.checkDeaths()
      if (this.cfg.respawn) this.respawnDead(dt)
      this.fx.update(dt)
      if (this.cfg.endMatch) this.checkEnd()
    }

    if (this.phase === 'ended') {
      this.fx.update(dt)
      if (this.endGate.tick(dt) && this.onEnd) {
        this.onEnd({ time: this.time, survivors: this.brawlers.filter((b) => b.alive) })
      }
    }

    if (this.onStep) this.onStep(dt)
  }

  private checkEnd(): void {
    const botsLeft = this.bots.filter((b) => b.alive).length
    const playerAlive = !this.player || this.player.alive
    if (!playerAlive) {
      this.phase = 'ended'
    } else if (this.cfg.endOnLastDeath ? botsLeft <= 1 : botsLeft === 0) {
      this.phase = 'ended'
    } else if (this.time >= this.cfg.duration) {
      this.phase = 'ended'
    }
  }

  private updateBrains(dt: number, playerControl?: () => BrawlerControl): void {
    for (const bot of this.bots) {
      if (!bot.alive) continue
      const brain = this.brains.get(bot)
      if (!brain) continue
      const ctrl = brain.think(bot, this.brawlers, this.arena.walls, dt, this.time)
      if (this.phase !== 'playing') {
        ctrl.firing = false
        ctrl.superQueued = false
      }
      bot.update(dt, ctrl)
    }
    if (this.player) {
      if (this.player.alive) {
        if (playerControl) {
          const ctrl = playerControl()
          this.player.update(dt, ctrl)
        } else {
          this.player.update(dt, idleControl(this.player))
        }
      } else {
        this.player.aiming = false
        this.player.update(dt, idleControl(this.player))
      }
    }
  }

  moveBrawlers(): void {
    for (const b of this.brawlers) {
      if (!b.alive && !b.dash.active) continue
      for (const o of this.brawlers) {
        if (o === b || !o.alive) continue
        const dx = b.pos.x - o.pos.x
        const dy = b.pos.y - o.pos.y
        const minD = b.r + o.r
        const d2 = dx * dx + dy * dy
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2)
          const push = (minD - d) / d
          const half = push / 2
          b.pos.x += dx * half
          b.pos.y += dy * half
          o.pos.x -= dx * half
          o.pos.y -= dy * half
        }
      }
      this.keepInArena(b)
    }
  }

  private keepInArena(b: Brawler): void {
    const c = { x: b.pos.x, y: b.pos.y, r: b.r }
    resolveCircle(this.arena.walls, c)
    b.pos.x = clamp(c.x, b.r, this.arena.width - b.r)
    b.pos.y = clamp(c.y, b.r, this.arena.height - b.r)
  }

  private fireLogic(): void {
    for (const b of this.brawlers) {
      if (!b.alive) continue
      if (b.superJustTriggered) {
        b.superJustTriggered = false
        this.doSupers(b)
      }
      if (b.wantsFireThisFrame()) {
        if (b.def.melee) this.doMelee(b)
        else this.doFire(b)
      }
    }
  }

  private doFire(b: Brawler): void {
    const def = b.def
    const powered = this.isPowered(b)
    const dmg = def.damage * (powered ? 1.35 : 1)
    const count = def.bulletCount
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * 0.05
      const angle = b.aimAngle + offset + rand(-0.015, 0.015)
      this.projectiles.push(
        spawnProjectile(b, angle, def.projectileSpeed, def.projectileRange, dmg, def.projectileSize, def.color, b.isPlayer, false),
      )
    }
    const mx = b.pos.x + Math.cos(b.aimAngle) * (b.r + 16)
    const my = b.pos.y + Math.sin(b.aimAngle) * (b.r + 16)
    this.fx.muzzle(mx, my, b.aimAngle, def.color)
    if (b.isPlayer) sfx.shoot()
    else sfx.shoot(this.bots.indexOf(b) % 3)
    this.events.fire?.(b, 'shot', this.time)
  }

  private doMelee(b: Brawler): void {
    const def = b.def
    const powered = this.isPowered(b)
    const dmg = def.damage * (powered ? 1.35 : 1)
    const range = def.meleeRange ?? 120
    const arc = def.meleeArc ?? 1.9

    for (const target of this.brawlers) {
      if (target === b || !target.alive) continue
      const dx = target.pos.x - b.pos.x
      const dy = target.pos.y - b.pos.y
      const d = Math.hypot(dx, dy)
      if (d > range + target.r) continue
      let diff = Math.atan2(dy, dx) - b.aimAngle
      while (diff > Math.PI) diff -= TAU
      while (diff < -Math.PI) diff += TAU
      if (Math.abs(diff) <= arc / 2) {
        this.applyMeleeHit(b, target, dmg)
      }
    }

    if (b.isPlayer) sfx.swing()
    else sfx.swing(this.bots.indexOf(b) % 3)
    this.events.fire?.(b, 'swing', this.time)
  }

  private applyMeleeHit(attacker: Brawler, target: Brawler, dmg: number): void {
    target.takeDamage(dmg)
    target.lastHitBy = attacker
    attacker.chargeSuper(dmg * attacker.def.superChargePerHit)

    const dir = Math.atan2(target.pos.y - attacker.pos.y, target.pos.x - attacker.pos.x)
    target.pos.x += Math.cos(dir) * 18
    target.pos.y += Math.sin(dir) * 18
    this.keepInArena(target)
    if (attacker.isPlayer || target.isPlayer) sfx.hit()
    this.fx.hitSpark(target.pos.x, target.pos.y, attacker.def.accent)
    this.fx.floatText(
      target.pos.x + rand(-12, 12),
      target.pos.y - target.r - 14,
      `${Math.round(dmg)}`,
      attacker.isPlayer ? '#ffd86b' : '#ff8a6b',
      attacker.isPlayer ? 26 : 20,
    )
    if (target.isPlayer) sfx.hurt()
    this.events.hit?.(attacker, target, dmg, this.time)
  }

  private doSupers(b: Brawler): void {
    const def = b.def
    const friendly = b.isPlayer
    switch (def.superType) {
      case 'storm': {
        const count = 7
        for (let i = 0; i < count; i++) {
          const t = (i / (count - 1)) * 2 - 1
          const angle = b.aimAngle + t * 0.55
          this.projectiles.push(
            spawnProjectile(
              b,
              angle,
              def.projectileSpeed * 1.35,
              def.superRange,
              def.superDamage,
              def.superSize,
              def.accent,
              friendly,
              true,
            ),
          )
        }
        this.fx.explosion(b.pos.x + Math.cos(b.aimAngle) * b.r, b.pos.y + Math.sin(b.aimAngle) * b.r, def.accent)
        break
      }
      case 'boulder': {
        this.projectiles.push(
          spawnProjectile(b, b.aimAngle, def.projectileSpeed * 0.55, def.superRange, def.superDamage, def.superSize, def.accent, friendly, true, 5),
        )
        this.fx.ring(b.pos.x, b.pos.y, def.accent, 90)
        break
      }
      case 'dash':
        this.fx.ring(b.pos.x, b.pos.y, def.accent, 60)
        break
    }
    if (friendly) sfx.super()
    else sfx.super(this.bots.indexOf(b) % 3)
    this.events.super?.(b, this.time)
    this.events.fire?.(b, 'super', this.time)
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.ttl -= dt
      p.trail.unshift({ x: p.x, y: p.y })
      if (p.trail.length > 7) p.trail.pop()

      let dead = p.ttl <= 0
      if (!dead) {
        for (const w of this.arena.walls) {
          if (circleRectCollide({ x: p.x, y: p.y, r: p.r }, w)) {
            this.fx.hitSpark(p.x - p.vx * dt, p.y - p.vy * dt, p.color)
            dead = true
            break
          }
        }
      }

      if (!dead) {
        for (const target of this.brawlers) {
          if (!target.alive || target === p.owner) continue
          const rr = p.r + target.r
          if (dist2(p.x, p.y, target.pos.x, target.pos.y) < rr * rr) {
            this.applyHit(p, target)
            if (p.pierce > 0) {
              p.pierce--
            } else {
              dead = true
            }
            break
          }
        }
      }

      if (dead) this.projectiles.splice(i, 1)
    }
  }

  private applyHit(p: Projectile, target: Brawler): void {
    const def = p.owner.def
    target.takeDamage(p.damage)
    target.lastHitBy = p.owner
    p.owner.chargeSuper(p.damage * def.superChargePerHit)

    const dir = Math.atan2(p.vy, p.vx)
    target.pos.x += Math.cos(dir) * 14
    target.pos.y += Math.sin(dir) * 14
    this.keepInArena(target)
    if (p.owner.isPlayer || target.isPlayer) sfx.hit()
    this.fx.hitSpark(target.pos.x, target.pos.y, p.color)
    this.fx.floatText(
      target.pos.x + rand(-12, 12),
      target.pos.y - target.r - 14,
      `${Math.round(p.damage)}`,
      p.owner.isPlayer ? '#ffd86b' : '#ff8a6b',
      p.owner.isPlayer ? 26 : 20,
    )
    if (target.isPlayer) sfx.hurt()
    this.events.hit?.(p.owner, target, p.damage, this.time)
  }

  private handleDashDamage(): void {
    for (const b of this.brawlers) {
      if (!b.alive || !b.dash.active) continue
      for (const target of this.brawlers) {
        if (target === b || !target.alive || b.dash.hitIds.has(target)) continue
        const rr = b.r + target.r + 10
        if (dist2(b.pos.x, b.pos.y, target.pos.x, target.pos.y) < rr * rr) {
          b.dash.hitIds.add(target)
          target.takeDamage(b.def.superDamage)
          target.lastHitBy = b
          const dir = Math.atan2(target.pos.y - b.pos.y, target.pos.x - b.pos.x)
          target.pos.x += Math.cos(dir) * 60
          target.pos.y += Math.sin(dir) * 60
          this.keepInArena(target)
          this.fx.explosion(target.pos.x, target.pos.y, b.def.accent)
          this.fx.floatText(target.pos.x, target.pos.y - target.r, `${Math.round(b.def.superDamage)}`, '#ffd23f', 30)
          sfx.dashHit()
          if (target === this.player || b.isPlayer) sfx.hit()
          this.events.hit?.(b, target, b.def.superDamage, this.time)
        }
      }
    }
  }

  private updatePickups(dt: number): void {
    for (const pu of this.pickups) {
      pu.pulse += dt
      if (!pu.active) {
        pu.respawn -= dt
        if (pu.respawn <= 0) pu.active = true
        continue
      }
      for (const b of this.brawlers) {
        if (!b.alive) continue
        if (dist2(pu.x, pu.y, b.pos.x, b.pos.y) < (pu.r + b.r) ** 2) {
          if (pu.kind === 'heal') {
            if (b.hp >= b.maxHp) continue
            b.heal(pu.amount)
            this.fx.floatText(pu.x, pu.y - 20, `+${Math.round(pu.amount)}`, '#5dff8f', 26)
            this.fx.ring(pu.x, pu.y, '#3fd46a', 60)
            this.events.pickup?.(b, 'heal')
          } else {
            this.powerUntil.set(b, this.time + 8)
            this.fx.floatText(pu.x, pu.y - 20, 'DMG UP!', '#ffd23f', 26)
            this.fx.ring(pu.x, pu.y, '#ffd23f', 60)
            this.events.pickup?.(b, 'power')
          }
          pu.active = false
          pu.respawn = 15
          sfx.pickup()
          break
        }
      }
    }
  }

  private checkDeaths(): void {
    for (const b of this.brawlers) {
      if (b.alive || b.deadProcessed) continue
      b.deadProcessed = true
      this.fx.explosion(b.pos.x, b.pos.y, b.def.color)

      const killer = b.lastHitBy && b.lastHitBy !== b && b.lastHitBy.alive ? b.lastHitBy : null
      if (killer) {
        killer.kills++
        if (killer.isPlayer) sfx.kill()
        else sfx.death()
      } else {
        sfx.death()
      }

      if (b.isPlayer) {
        b.aiming = false
        sfx.death()
      }

      this.events.death?.(b, killer, this.time)

      if (this.cfg.respawn) {
        const spawn = this.spawnPoints.get(b)
        if (spawn) {
          this.respawnQueue.set(b, { x: spawn.x, y: spawn.y, timer: b.isPlayer ? 2 : 3 })
        }
      }
    }
  }

  private respawnDead(dt: number): void {
    if (this.respawnQueue.size === 0) return
    for (const b of this.respawnQueue.keys()) {
      const spawn = this.respawnQueue.get(b)!
      spawn.timer -= dt
      if (spawn.timer > 0) continue
      b.alive = true
      b.deadProcessed = false
      b.hp = b.maxHp
      b.pos.x = spawn.x
      b.pos.y = spawn.y
      b.lastHitBy = null
      b.dash.hitIds.clear()
      b.aiming = false
      this.respawnQueue.delete(b)
      this.fx.ring(b.pos.x, b.pos.y, b.def.accent, 90)
      this.events.respawn?.(b)
    }
  }

  private isPowered(b: Brawler): boolean {
    const until = this.powerUntil.get(b)
    return until !== undefined && until > this.time
  }
}
