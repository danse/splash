import { Input } from './core/input'
import { Camera } from './core/camera'
import { GameLoop } from './core/loop'
import { Brawler, BrawlerControl } from './entities/brawler'
import { randomBrawlerId } from './entities/bot'
import { Projectile } from './entities/projectile'
import { Arena } from './world/arena'
import { drawArena, drawBushes, drawBrawler, drawProjectile, drawPickup, drawAimPointer, inBush } from './render'
import { Hud } from './ui/hud'
import { sfx, initAudio } from './audio'
import { TAU } from './core/math'
import { DebugOverlay, isDebug, type DebugInfo } from './debug'
import { Simulation, SimPhase } from './sim/simulation'
import { DIFFICULTIES, type DifficultyId } from './entities/difficulty'

export interface MatchResult {
  won: boolean
  kills: number
  botsLeft: number
  time: number
  brawlerName: string
}

export type ModeId = 'brawl' | 'practice'

export interface GameMode {
  id: ModeId
  attackers: number
  focusPlayer: boolean
  dummyBots: boolean
  respawn: boolean
  timer: boolean
  endMatch: boolean
  showExit: boolean
  announce: string
  announceGold: boolean
}

const MATCH_DURATION = 120
const NUM_BOTS = 5
const COUNTDOWN = 3.4
const END_DELAY = 1.8
const CAMERA_EDGE_MARGIN = 120

export const MODES: Record<ModeId, GameMode> = {
  brawl: {
    id: 'brawl',
    attackers: NUM_BOTS,
    focusPlayer: false,
    dummyBots: false,
    respawn: false,
    timer: true,
    endMatch: true,
    showExit: false,
    announce: 'FIGHT!',
    announceGold: false,
  },
  practice: {
    id: 'practice',
    attackers: 1,
    focusPlayer: true,
    dummyBots: true,
    respawn: true,
    timer: false,
    endMatch: false,
    showExit: true,
    announce: 'PRACTICE — 1 BOT FIGHTS',
    announceGold: true,
  },
}

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private input: Input
  private camera: Camera
  private loop: GameLoop
  private hud: Hud
  private sim!: Simulation
  private lastAim = 0
  private fireHeldPrev = false
  private viewW = 0
  private viewH = 0
  private dpr = 1
  private mode: GameMode = MODES.brawl
  private debug: DebugOverlay | null = null
  private prevCamX = 0
  private camDeltas: number[] = []
  private debugFpsTime = 0
  private debugFpsSteps = 0
  private debugFps = 0
  private goAnnounced = false
  onEnd: ((r: MatchResult) => void) | null = null
  onExit: (() => void) | null = null

  get arena() {
    return this.sim.arena
  }
  set arena(a: Arena) {
    this.sim.arena = a
  }
  get brawlers() {
    return this.sim.brawlers
  }
  get bots() {
    return this.sim.bots
  }
  get player() {
    return this.sim.player!
  }
  get projectiles() {
    return this.sim.projectiles
  }
  get pickups() {
    return this.sim.pickups
  }
  get phase() {
    return this.sim.phase
  }
  set phase(p: SimPhase) {
    this.sim.phase = p
  }
  get brains() {
    return this.sim.brains
  }
  get time() {
    return this.sim.time
  }

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.input = new Input()
    this.camera = new Camera()
    this.camera.marginPx = CAMERA_EDGE_MARGIN
    this.hud = new Hud(
      this.input,
      () => this.exitToMenu(),
    )

    this.resize()
    window.addEventListener('resize', () => this.resize())

    this.loop = new GameLoop((dt) => this.update(dt))
    this.loop.start()

    if (isDebug()) this.debug = new DebugOverlay()
  }

  start(): void {
    this.loop.start()
  }

  private exitToMenu(): void {
    this.loop.stop()
    if (this.onExit) this.onExit()
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

  startMatch(brawlerId: string, modeId: ModeId = 'brawl', difficulty: DifficultyId = 'hard'): void {
    initAudio()
    this.mode = MODES[modeId]
    const brainOpts = modeId === 'practice' ? {} : DIFFICULTIES[difficulty].brain
    this.goAnnounced = false
    this.sim = new Simulation(Math.floor(Math.random() * 1e9), {
      attackers: this.mode.attackers,
      respawn: this.mode.respawn,
      timer: this.mode.timer,
      endMatch: this.mode.endMatch,
      endOnLastDeath: false,
      duration: MATCH_DURATION,
      countdown: COUNTDOWN,
      endDelay: END_DELAY,
      focusPlayer: this.mode.focusPlayer,
      dummyBots: this.mode.dummyBots,
      spawnCount: NUM_BOTS + 1,
      modeId: this.mode.id,
    })

    this.sim.addPlayer(brawlerId)
    for (let i = 1; i <= NUM_BOTS; i++) {
      let x: number | undefined
      let y: number | undefined
      if (this.mode.focusPlayer && i === 1) {
        const p = this.sim.player!
        const cx = p.pos.x - this.sim.arena.width / 2
        const cy = p.pos.y - this.sim.arena.height / 2
        const cl = Math.max(1, Math.hypot(cx, cy))
        x = p.pos.x - (cx / cl) * 260
        y = p.pos.y - (cy / cl) * 260
      }
      this.sim.addBot(randomBrawlerId(), x, y, brainOpts)
    }
    this.sim.addDefaultPickups()

    this.sim.onEnd = (r) => {
      const p = this.sim.player!
      const botsLeft = this.sim.bots.filter((b) => b.alive).length
      const botBest = this.sim.bots.reduce((m, b) => Math.max(m, b.kills), 0)
      const won = p.alive && p.kills >= botBest
      const result: MatchResult = {
        won,
        kills: p.kills,
        botsLeft,
        time: Math.min(MATCH_DURATION, r.time),
        brawlerName: p.def.name,
      }
      this.hud.hide()
      if (won) sfx.win()
      else sfx.lose()
      if (this.onEnd) this.onEnd(result)
    }
    this.sim.onStep = () => {
      if (this.sim.phase === 'playing' && !this.goAnnounced) {
        this.goAnnounced = true
        this.hud.announce('GO!', true)
      }
    }

    this.camera.follow(this.sim.player!, this.sim.arena.bounds)
    this.hud.show()
    this.hud.announce(this.mode.announce, this.mode.announceGold)
    this.hud.setKills(0)
    this.hud.setBots(this.sim.bots.length)
    this.hud.showExit(this.mode.showExit)
    this.hud.setTimer(this.mode.timer ? MATCH_DURATION : Infinity)
  }

  private update(dt: number): void {
    if (!this.sim) return
    this.updateDebug()
    this.sim.step(dt, () => this.playerControl())
    this.camera.update(dt)
    this.updateHud()
    this.render()
  }

  moveBrawlers(): void {
    this.sim.moveBrawlers()
  }

  private playerControl(): BrawlerControl {
    const p = this.sim.player!
    const tap = this.input.consumeAimTap()
    const mv = this.input.moveVec()
    const stick = this.input.state.aim
    const fireHeld = stick.active
    const released = !fireHeld && this.fireHeldPrev
    this.fireHeldPrev = fireHeld
    const superPressed = this.input.consumeSuper()
    const superQueued = superPressed.queued
    const superAngle = superPressed.angle

    let aim = this.lastAim
    const stickAiming = stick.active && stick.mag > 0.18
    if (superQueued) {
      if (superAngle !== null) {
        aim = superAngle
      } else if (this.sim.phase === 'playing') {
        const target = this.sim.closestEnemy(p)
        if (target) {
          aim = Math.atan2(target.pos.y - p.pos.y, target.pos.x - p.pos.x)
        }
      }
    } else if (stickAiming) {
      aim = Math.atan2(stick.dy, stick.dx)
    }
    if (tap && this.sim.phase === 'playing') {
      const target = this.sim.closestEnemy(p)
      if (target) {
        aim = Math.atan2(target.pos.y - p.pos.y, target.pos.x - p.pos.x)
      }
    }
    this.lastAim = aim

    p.aiming = fireHeld
    const fireOnce = (released || tap) && this.sim.phase === 'playing'
    return {
      moveX: mv.x,
      moveY: mv.y,
      moveMag: mv.mag,
      aimAngle: aim,
      firing: false,
      fireOnce,
      superQueued,
    }
  }

  private updateHud(): void {
    if (this.sim.phase === 'ended') return
    const p = this.sim.player!
    this.hud.update(p.hp, p.maxHp, p.superCharge, p.superReady)
    this.hud.setTimer(this.mode.timer ? MATCH_DURATION - this.sim.time : Infinity)
  }

  private updateDebug(): void {
    if (!this.debug) return
    const cam = this.camera
    const delta = Math.abs(cam.x - this.prevCamX)
    this.prevCamX = cam.x
    this.camDeltas.push(delta)
    if (this.camDeltas.length > 120) this.camDeltas.shift()

    this.debugFpsSteps++
    this.debugFpsTime += 1 / 120
    if (this.debugFpsTime >= 0.5) {
      this.debugFps = this.debugFpsSteps / this.debugFpsTime
      this.debugFpsTime = 0
      this.debugFpsSteps = 0
    }

    const arena = this.sim.arena
    const scale = cam.scale
    const hw = cam.viewW / 2 / scale
    const hh = cam.viewH / 2 / scale
    const target = cam.targetPos
    const info: DebugInfo = {
      mode: this.mode.id,
      phase: this.sim.phase,
      fps: this.debugFps,
      camX: cam.x,
      camY: cam.y,
      camScale: scale,
      viewW: cam.viewW,
      viewH: cam.viewH,
      dpr: this.dpr,
      arenaW: arena.width,
      arenaH: arena.height,
      hw,
      hh,
      minX: hw,
      maxX: arena.width - hw,
      minY: hh,
      maxY: arena.height - hh,
      viewWider: hw > arena.width / 2,
      viewTaller: hh > arena.height / 2,
      playerX: this.sim.player!.pos.x,
      playerY: this.sim.player!.pos.y,
      targetX: target ? target.pos.x : NaN,
      targetY: target ? target.pos.y : NaN,
      wallLeft: (0 - cam.x) * scale + cam.viewW / 2,
      wallRight: (arena.width - cam.x) * scale + cam.viewW / 2,
      wallTop: (0 - cam.y) * scale + cam.viewH / 2,
      wallBottom: (arena.height - cam.y) * scale + cam.viewH / 2,
      flips: this.camDeltas.filter((d) => d > 50).length,
      maxDelta: this.camDeltas.length ? Math.max(...this.camDeltas) : 0,
    }
    this.debug.update(info)
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
    ctx.translate(w / 2, h / 2)
    ctx.scale(this.camera.scale, this.camera.scale)
    ctx.translate(-this.camera.snapX(dpr), -this.camera.snapY(dpr))

    drawArena(ctx, this.sim.arena, false)

    for (const pu of this.sim.pickups) {
      if (pu.active) drawPickup(ctx, pu)
    }

    for (const p of this.sim.projectiles) {
      this.drawProjectileTrail(ctx, p)
    }

    const hidden: Brawler[] = []
    const visible: Brawler[] = []
    for (const b of this.sim.brawlers) {
      if (!b.alive) continue
      if (inBush(b, this.sim.arena)) hidden.push(b)
      else visible.push(b)
    }
    for (const b of hidden) {
      if (b.aiming) drawAimPointer(ctx, b, this.sim.arena)
      drawBrawler(ctx, b, this.sim.arena, { walls: this.sim.arena.walls, showHealthBars: true, time: this.sim.time })
    }
    drawBushes(ctx, this.sim.arena)
    for (const b of visible) {
      if (b.aiming) drawAimPointer(ctx, b, this.sim.arena)
      drawBrawler(ctx, b, this.sim.arena, { walls: this.sim.arena.walls, showHealthBars: true, time: this.sim.time })
    }

    for (const p of this.sim.projectiles) drawProjectile(ctx, p)

    this.sim.fx.render(ctx)
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
