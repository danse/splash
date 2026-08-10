import { Input } from './core/input'
import { Camera } from './core/camera'
import { GameLoop } from './core/loop'
import { FX } from './fx/particles'
import { Brawler, BRAWLER_DEFS } from './entities/brawler'
import { BotBrain, randomBrawlerId } from './entities/bot'
import { Projectile, spawnProjectile } from './entities/projectile'
import { Pickup, makePickup } from './entities/pickup'
import { generateArena, Arena } from './world/arena'
import { resolveCircle, circleRectCollide } from './world/collision'
import { drawArena, drawBushes, drawBrawler, drawProjectile, drawPickup, inBush } from './render'
import { Hud } from './ui/hud'
import { sfx, initAudio } from './audio'
import { dist2, rand, TAU } from './core/math'
import { EndGate } from './core/endGate'

export interface MatchResult {
  won: boolean
  kills: number
  botsLeft: number
  time: number
  brawlerName: string
}

type Phase = 'countdown' | 'playing' | 'ended'

const MATCH_DURATION = 120
const NUM_BOTS = 5

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private input: Input
  private camera: Camera
  private loop: GameLoop
  private fx: FX
  private hud: Hud
  private time = 0
  private countdown = 3.4
  private phase: Phase = 'countdown'
  private endGate = new EndGate(1.8)
  private lastAim = 0
  private viewW = 0
  private viewH = 0
  private dpr = 1
  private powerUntil = new Map<Brawler, number>()
  onEnd: ((r: MatchResult) => void) | null = null

  arena!: Arena
  brawlers: Brawler[] = []
  bots: Brawler[] = []
  player!: Brawler
  private brains = new Map<Brawler, BotBrain>()
  private projectiles: Projectile[] = []
  private pickups: Pickup[] = []
  private timeSinceTick = 0

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.input = new Input()
    this.camera = new Camera()
    this.fx = new FX()
    this.hud = new Hud(() => this.input.queueSuper())

    this.resize()
    window.addEventListener('resize', () => this.resize())

    this.loop = new GameLoop((dt) => this.update(dt))
    this.loop.start()
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = window.innerWidth
    const h = window.innerHeight
    if (Math.abs(w - this.viewW) < 2 && Math.abs(h - this.viewH) < 2 && dpr === this.dpr) return
    this.dpr = dpr
    this.viewW = w
    this.viewH = h
    this.canvas.width = Math.floor(w * dpr)
    this.canvas.height = Math.floor(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    this.camera.setViewport(w, h)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  startMatch(brawlerId: string): void {
    initAudio()
    this.arena = generateArena(Math.floor(Math.random() * 1e9), NUM_BOTS + 1)
    this.brawlers = []
    this.bots = []
    this.brains.clear()
    this.projectiles = []
    this.pickups = []
    this.powerUntil.clear()
    this.time = 0
    this.countdown = 3.4
    this.phase = 'countdown'
    this.endGate.reset()

    const def = BRAWLER_DEFS[brawlerId]
    const spawns = this.arena.spawnPoints
    const player = new Brawler(def, spawns[0].x, spawns[0].y)
    player.isPlayer = true
    this.player = player
    this.brawlers.push(player)

    for (let i = 1; i <= NUM_BOTS; i++) {
      const botDef = BRAWLER_DEFS[randomBrawlerId()]
      const bot = new Brawler(botDef, spawns[i].x, spawns[i].y)
      this.bots.push(bot)
      this.brawlers.push(bot)
      this.brains.set(bot, new BotBrain(spawns[i].x, spawns[i].y))
    }

    const center = this.arena.powerSpots
    this.pickups.push(makePickup(center[0].x, center[0].y, 'power', 1))
    this.pickups.push(makePickup(center[1].x, center[1].y, 'heal', 2600))
    this.pickups.push(makePickup(center[2].x, center[2].y, 'power', 1))
    this.pickups.push(makePickup(center[3].x, center[3].y, 'heal', 2600))
    for (let i = 0; i < 3; i++) {
      this.pickups.push(
        makePickup(
          rand(200, this.arena.width - 200),
          rand(200, this.arena.height - 200),
          'heal',
          2000,
        ),
      )
    }

    this.camera.follow(this.player, this.arena.bounds)
    this.hud.show()
    this.hud.announce('FIGHT!', false)
    this.hud.setKills(0)
    this.hud.setBots(this.bots.length)
    this.hud.setTimer(MATCH_DURATION)
  }

  private update(dt: number): void {
    this.timeSinceTick += dt
    if (!this.arena) return

    if (this.phase === 'countdown') {
      this.countdown -= dt
      this.updateBrains(dt)
      this.moveBrawlers()
      this.fx.update(dt)
      this.camera.update(dt)
      this.updateHud()
      if (this.countdown <= 0) {
        this.phase = 'playing'
        this.hud.announce('GO!', true)
        sfx.ready()
      }
      this.render()
      return
    }

    if (this.phase === 'playing') {
      this.time += dt
      this.updateBrains(dt)
      this.moveBrawlers()
      this.fireLogic()
      this.updateProjectiles(dt)
      this.updatePickups(dt)
      this.handleDashDamage()
      this.checkDeaths()
      this.fx.update(dt)
      this.camera.update(dt)
      this.updateHud()

      const botsLeft = this.bots.filter((b) => b.alive).length
      if (!this.player.alive) {
        this.phase = 'ended'
      } else if (botsLeft === 0) {
        this.phase = 'ended'
      } else if (this.time >= MATCH_DURATION) {
        this.phase = 'ended'
      }
    }

    if (this.phase === 'ended') {
      this.fx.update(dt)
      this.camera.update(dt)
      if (this.endGate.tick(dt) && this.onEnd) {
        const botsLeft = this.bots.filter((b) => b.alive).length
        const botBest = this.bots.reduce((m, b) => Math.max(m, b.kills), 0)
        const won = this.player.alive && this.player.kills >= botBest
        const r: MatchResult = {
          won,
          kills: this.player.kills,
          botsLeft,
          time: Math.min(MATCH_DURATION, this.time),
          brawlerName: this.player.def.name,
        }
        this.hud.hide()
        if (won) sfx.win()
        else sfx.lose()
        this.onEnd(r)
      }
    }

    this.render()
  }

  private updateBrains(dt: number): void {
    for (const bot of this.bots) {
      if (!bot.alive) continue
      const brain = this.brains.get(bot)!
      const ctrl = brain.think(bot, this.brawlers, this.arena.walls, dt, this.time)
      if (this.phase !== 'playing') {
        ctrl.firing = false
        ctrl.superQueued = false
      }
      bot.update(dt, ctrl)
    }
    this.updatePlayer(dt)
  }

  private updatePlayer(dt: number): void {
    const p = this.player
    if (!p.alive) {
      p.update(dt, { moveX: 0, moveY: 0, moveMag: 0, aimAngle: p.facing, firing: false, superQueued: false })
      return
    }
    const mv = this.input.moveVec()
    const stick = this.input.state.aim
    let aim = this.lastAim
    let firing = false

    if (this.input.isTouchMode()) {
      if (stick.active) {
        if (stick.mag > 0.18) {
          aim = Math.atan2(stick.dy, stick.dx)
          firing = true
        } else {
          aim = this.lastAim
        }
      }
    } else {
      if (stick.active) {
        if (stick.mag > 0.18) {
          aim = Math.atan2(stick.dy, stick.dx)
          firing = true
        }
      } else {
        const sx = this.worldToScreenX(p.pos.x)
        const sy = this.worldToScreenY(p.pos.y)
        aim = Math.atan2(this.input.state.mouse.y - sy, this.input.state.mouse.x - sx)
        firing = this.input.state.fireHeld
      }
    }
    this.lastAim = aim

    const superQueued = this.input.consumeSuper()
    p.update(dt, { moveX: mv.x, moveY: mv.y, moveMag: mv.mag, aimAngle: aim, firing, superQueued })
  }

  private moveBrawlers(): void {
    for (const b of this.brawlers) {
      if (!b.alive && !b.dash.active) continue
      resolveCircle(this.arena.walls, { x: b.pos.x, y: b.pos.y, r: b.r })
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
    }
  }

  private fireLogic(): void {
    for (const b of this.brawlers) {
      if (!b.alive) continue
      if (b.superJustTriggered) {
        b.superJustTriggered = false
        this.doSupers(b)
      }
      if (b.wantsFireThisFrame()) {
        this.doFire(b)
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
        spawnProjectile(
          b,
          angle,
          def.projectileSpeed,
          def.projectileRange,
          dmg,
          def.projectileSize,
          def.color,
          b.isPlayer,
          false,
        ),
      )
    }
    const mx = b.pos.x + Math.cos(b.aimAngle) * (b.r + 16)
    const my = b.pos.y + Math.sin(b.aimAngle) * (b.r + 16)
    this.fx.muzzle(mx, my, b.aimAngle, def.color)
    if (b.isPlayer) {
      sfx.shoot()
      this.camera.shake(0.06)
    } else {
      sfx.shoot(this.bots.indexOf(b) % 3)
    }
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
              def.projectileRange * 1.1,
              def.superDamage,
              def.projectileSize * 1.5,
              def.accent,
              friendly,
              true,
            ),
          )
        }
        this.fx.explosion(b.pos.x + Math.cos(b.aimAngle) * b.r, b.pos.y + Math.sin(b.aimAngle) * b.r, def.accent)
        this.camera.shake(0.4)
        break
      }
      case 'boulder': {
        this.projectiles.push(
          spawnProjectile(
            b,
            b.aimAngle,
            def.projectileSpeed * 0.55,
            def.projectileRange * 1.3,
            def.superDamage,
            42,
            def.accent,
            friendly,
            true,
            5,
          ),
        )
        this.camera.shake(0.5)
        this.fx.ring(b.pos.x, b.pos.y, def.accent, 90)
        break
      }
      case 'dash':
        this.camera.shake(0.35)
        this.fx.ring(b.pos.x, b.pos.y, def.accent, 60)
        break
    }
    if (friendly) sfx.super()
    else sfx.super(this.bots.indexOf(b) % 3)
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
    if (p.owner.isPlayer || target.isPlayer) {
      sfx.hit()
      this.camera.shake(0.12)
    }
    this.fx.hitSpark(target.pos.x, target.pos.y, p.color)
    this.fx.floatText(
      target.pos.x + rand(-12, 12),
      target.pos.y - target.r - 14,
      `${Math.round(p.damage)}`,
      p.owner.isPlayer ? '#ffd86b' : '#ff8a6b',
      p.owner.isPlayer ? 26 : 20,
    )
    if (target.isPlayer) sfx.hurt()
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
          this.fx.explosion(target.pos.x, target.pos.y, b.def.accent)
          this.fx.floatText(target.pos.x, target.pos.y - target.r, `${Math.round(b.def.superDamage)}`, '#ffd23f', 30)
          this.camera.shake(0.25)
          sfx.dashHit()
          if (target === this.player || b.isPlayer) sfx.hit()
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
          } else {
            this.powerUntil.set(b, this.time + 8)
            this.fx.floatText(pu.x, pu.y - 20, 'DMG UP!', '#ffd23f', 26)
            this.fx.ring(pu.x, pu.y, '#ffd23f', 60)
            if (b.isPlayer) this.hud.announce('DAMAGE UP!', true)
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
      this.camera.shake(0.35)

      const killer = b.lastHitBy && b.lastHitBy !== b && b.lastHitBy.alive ? b.lastHitBy : null
      if (killer) {
        killer.kills++
        if (killer.isPlayer) {
          this.hud.setKills(killer.kills)
          this.hud.addKill(b.def.name, killer.def.name)
          sfx.kill()
        } else {
          sfx.death()
          this.hud.addKill(b.def.name, killer.def.name)
        }
      } else {
        sfx.death()
      }

      if (b.isPlayer) {
        sfx.death()
        this.camera.shake(0.6)
      } else {
        this.hud.setBots(this.bots.filter((x) => x.alive).length)
      }
    }
  }

  private isPowered(b: Brawler): boolean {
    const until = this.powerUntil.get(b)
    return until !== undefined && until > this.time
  }

  private updateHud(): void {
    if (this.phase === 'ended') return
    const p = this.player
    this.hud.update(p.hp, p.maxHp, p.superCharge, p.superReady)
    this.hud.setTimer(MATCH_DURATION - this.time)
  }

  private worldToScreenX(wx: number): number {
    return (wx - this.camera.x) * this.camera.scale + this.viewW / 2
  }

  private worldToScreenY(wy: number): number {
    return (wy - this.camera.y) * this.camera.scale + this.viewH / 2
  }

  private render(): void {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    const dpr = this.dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0d1220'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(w / 2 + this.camera.shakeX, h / 2 + this.camera.shakeY)
    ctx.scale(this.camera.scale, this.camera.scale)
    ctx.translate(-this.camera.snapX(dpr), -this.camera.snapY(dpr))

    drawArena(ctx, this.arena, false)

    for (const pu of this.pickups) {
      if (pu.active) drawPickup(ctx, pu)
    }

    for (const p of this.projectiles) {
      this.drawProjectileTrail(ctx, p)
    }

    const hidden: Brawler[] = []
    const visible: Brawler[] = []
    for (const b of this.brawlers) {
      if (!b.alive) continue
      if (inBush(b, this.arena)) hidden.push(b)
      else visible.push(b)
    }
    for (const b of hidden) drawBrawler(ctx, b, this.arena, { walls: this.arena.walls, showHealthBars: true })
    drawBushes(ctx, this.arena)
    for (const b of visible) drawBrawler(ctx, b, this.arena, { walls: this.arena.walls, showHealthBars: true })

    for (const p of this.projectiles) drawProjectile(ctx, p)

    this.fx.render(ctx)
    ctx.restore()
  }

  private drawProjectileTrail(ctx: CanvasRenderingContext2D, p: Projectile): void {
    if (p.trail.length < 2) return
    for (let i = 1; i < p.trail.length; i++) {
      const t = i / p.trail.length
      ctx.globalAlpha = t * 0.4
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.trail[i].x, p.trail[i].y, p.r * 0.7 * t, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
