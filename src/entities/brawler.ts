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
  superType: SuperType
  superDamage: number
  superChargePerHit: number
}

export const BRAWLER_DEFS: Record<string, BrawlerDef> = {
  blaster: {
    id: 'blaster',
    name: 'Blaster',
    color: '#3aa0ff',
    accent: '#ffe08a',
    glyph: '⚡',
    radius: 26,
    maxHp: 4600,
    speed: 300,
    damage: 340,
    fireRate: 2.6,
    projectileSpeed: 1050,
    projectileRange: 560,
    projectileSize: 13,
    bulletCount: 1,
    spread: 0,
    superType: 'storm',
    superDamage: 540,
    superChargePerHit: 0.14,
  },
  charger: {
    id: 'charger',
    name: 'Charger',
    color: '#ff5d5d',
    accent: '#ffd23f',
    glyph: '⛏',
    radius: 24,
    maxHp: 3600,
    speed: 440,
    damage: 260,
    fireRate: 3.4,
    projectileSpeed: 900,
    projectileRange: 330,
    projectileSize: 11,
    bulletCount: 1,
    spread: 0,
    superType: 'dash',
    superDamage: 640,
    superChargePerHit: 0.16,
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    color: '#3fd46a',
    accent: '#e8f7ff',
    glyph: '🛡',
    radius: 32,
    maxHp: 7200,
    speed: 230,
    damage: 420,
    fireRate: 1.6,
    projectileSpeed: 760,
    projectileRange: 480,
    projectileSize: 18,
    bulletCount: 1,
    spread: 0,
    superType: 'boulder',
    superDamage: 1200,
    superChargePerHit: 0.11,
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
    this.chargeSuper(dmg * 0.22)
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

    this.aimAngle = ctrl.aimAngle
    this.facing = angleLerp(this.facing, this.aimAngle, 1 - Math.pow(0.0001, dt))

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

    if (ctrl.fireOnce && this.fireCd <= 0 && !this.dash.active) {
      this.firePressed = true
      this.fireCd = 1 / this.def.fireRate
    }
    if (ctrl.firing && this.fireCd <= 0 && !this.dash.active) {
      this.firePressed = true
      this.fireCd = 1 / this.def.fireRate
    }
  }

  triggerSuper(): void {
    this.superCharge = 0
    this.superCd = 3.2
    this.superJustTriggered = true
    switch (this.def.superType) {
      case 'dash': {
        const speed = 1300
        this.dash = {
          active: true,
          dirX: Math.cos(this.aimAngle),
          dirY: Math.sin(this.aimAngle),
          speed,
          t: 0.34,
          duration: 0.34,
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
