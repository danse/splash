import { angleLerp, clamp } from '../core/math'

export type SuperType = 'storm' | 'dash' | 'boulder'

export interface BrawlerDef {
  id: string
  name: string
  color: string
  accent: string
  glyph: string
  radius: number
  maxHp: number
  speed: number
  damage: number
  fireRate: number
  projectileSpeed: number
  projectileRange: number
  projectileSize: number
  bulletCount: number
  spread: number
  melee?: boolean
  meleeRange?: number
  meleeArc?: number
  superType: SuperType
  superDamage: number
  superChargePerHit: number
  superRange: number
  superSize: number
  sprite: string
  spriteScale: number
  barrelSprite?: string
  fireSprite?: string
}

export const BRAWLER_DEFS: Record<string, BrawlerDef> = {
  blaster: {
    id: 'blaster',
    name: 'Blaster',
    color: '#3aa0ff',
    accent: '#ffe08a',
    glyph: '⚡',
    radius: 26,
    maxHp: 4800,
    speed: 320,
    damage: 340,
    fireRate: 2.6,
    projectileSpeed: 1050,
    projectileRange: 600,
    projectileSize: 13,
    bulletCount: 1,
    spread: 0,
    superType: 'storm',
    superDamage: 540,
    superChargePerHit: 0.09,
    superRange: 660,
    superSize: 19.5,
    sprite: 'blaster',
    spriteScale: 52,
    fireSprite: 'blaster-fire',
  },
  charger: {
    id: 'charger',
    name: 'Charger',
    color: '#ff5d5d',
    accent: '#ffd23f',
    glyph: '⛏',
    radius: 24,
    maxHp: 6600,
    speed: 550,
    damage: 420,
    fireRate: 3.4,
    projectileSpeed: 900,
    projectileRange: 540,
    projectileSize: 11,
    bulletCount: 1,
    spread: 0,
    superType: 'dash',
    superDamage: 640,
    superChargePerHit: 0.1,
    superRange: 442,
    superSize: 16.5,
    sprite: 'charger',
    spriteScale: 48,
    fireSprite: 'charger-fire',
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    color: '#3fd46a',
    accent: '#e8f7ff',
    glyph: '🛡',
    radius: 32,
    maxHp: 5600,
    speed: 230,
    damage: 330,
    fireRate: 1.6,
    projectileSpeed: 760,
    projectileRange: 480,
    projectileSize: 18,
    bulletCount: 1,
    spread: 0,
    melee: true,
    meleeRange: 115,
    meleeArc: 1.9,
    superType: 'boulder',
    superDamage: 900,
    superChargePerHit: 0.07,
    superRange: 624,
    superSize: 42,
    sprite: 'tank',
    spriteScale: 64,
    barrelSprite: 'tank-barrel',
  },
}

export interface DashState {
  active: boolean
  dirX: number
  dirY: number
  speed: number
  t: number
  duration: number
  hitIds: Set<Brawler>
}

export const SWING_DURATION = 0.4
const ANGLE_LERP_BASE = 0.0001

export interface BrawlerControl {
  moveX: number
  moveY: number
  moveMag: number
  aimAngle: number
  firing: boolean
  fireOnce?: boolean
  superQueued: boolean
}

export class Brawler {
  pos = { x: 0, y: 0 }
  r: number
  hp: number
  maxHp: number
  speed: number
  def: BrawlerDef
  facing = 0
  aimAngle = 0
  fireCd = 0
  superCharge = 0
  superCd = 0
  alive = true
  isPlayer = false
  kills = 0
  flash = 0
  dash: DashState = { active: false, dirX: 0, dirY: 0, speed: 0, t: 0, duration: 0, hitIds: new Set() }
  superJustTriggered = false
  moving = false
  lastHitBy: Brawler | null = null
  deadProcessed = false
  aiming = false
  swingT = 0
  fireFacingTimer = 0
  private firePressed = false

  constructor(def: BrawlerDef, x: number, y: number) {
    this.def = def
    this.r = def.radius
    this.maxHp = def.maxHp
    this.hp = def.maxHp
    this.speed = def.speed
    this.pos.x = x
    this.pos.y = y
  }

  get superReady(): boolean {
    return this.superCharge >= 1 && this.superCd <= 0
  }

  chargeSuper(n: number): void {
    this.superCharge = clamp(this.superCharge + n, 0, 1)
  }

  takeDamage(dmg: number): void {
    if (!this.alive) return
    this.hp -= dmg
    this.flash = 0.14
    this.chargeSuper(dmg * 0.12)
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
    }
  }

  heal(n: number): void {
    this.hp = clamp(this.hp + n, 0, this.maxHp)
  }

  update(dt: number, ctrl: BrawlerControl): void {
    if (!this.alive) return
    this.flash = Math.max(0, this.flash - dt)
    this.fireCd = Math.max(0, this.fireCd - dt)
    this.superCd = Math.max(0, this.superCd - dt)
    this.swingT = Math.max(0, this.swingT - dt / SWING_DURATION)

    this.aimAngle = ctrl.aimAngle

    if (this.dash.active) {
      this.dash.t -= dt
      this.pos.x += this.dash.dirX * this.dash.speed * dt
      this.pos.y += this.dash.dirY * this.dash.speed * dt
      if (this.dash.t <= 0) this.dash.active = false
    } else {
      this.pos.x += ctrl.moveX * this.speed * dt
      this.pos.y += ctrl.moveY * this.speed * dt
      this.moving = ctrl.moveMag > 0.15
    }

    this.firePressed = false
    if (ctrl.superQueued && this.superReady) {
      this.triggerSuper()
    }

    if ((ctrl.fireOnce || ctrl.firing) && this.fireCd <= 0 && !this.dash.active) {
      this.firePressed = true
      this.fireCd = 1 / this.def.fireRate
      this.fireFacingTimer = 0.2
    }
    if (this.def.melee && this.firePressed) this.swingT = 1

    let targetFacing: number | null = null
    if (this.fireFacingTimer > 0) {
      targetFacing = this.aimAngle
    } else if (ctrl.moveMag > 0.15) {
      targetFacing = Math.atan2(ctrl.moveY, ctrl.moveX)
    }

    this.fireFacingTimer = Math.max(0, this.fireFacingTimer - dt)

    if (targetFacing !== null) {
      this.facing = angleLerp(this.facing, targetFacing, 1 - Math.pow(ANGLE_LERP_BASE, dt))
    }
  }

  triggerSuper(): void {
    this.superCharge = 0
    this.superCd = 3.2
    this.superJustTriggered = true
    switch (this.def.superType) {
      case 'dash': {
        const speed = 1300
        const duration = this.def.superRange / speed
        this.dash = {
          active: true,
          dirX: Math.cos(this.aimAngle),
          dirY: Math.sin(this.aimAngle),
          speed,
          t: duration,
          duration,
          hitIds: new Set(),
        }
        break
      }
      case 'storm':
      case 'boulder':
        break
    }
  }

  wantsFireThisFrame(): boolean {
    return this.firePressed
  }

  get isDashing(): boolean {
    return this.dash.active
  }
}
