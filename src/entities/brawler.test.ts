import { describe, expect, it, beforeEach } from 'vitest'
import { Brawler, BRAWLER_DEFS, BrawlerControl } from './brawler'

const ARCHETYPE_ROSTER = [
  'blaster',
  'charger',
  'tank',
  'sniper',
  'gunner',
  'ranger',
  'scout',
  'assassin',
  'bruiser',
  'juggernaut',
  'demolisher',
  'raider',
]

describe('Archetype roster', () => {
  it('defines a complete brawler for every archetype', () => {
    for (const id of ARCHETYPE_ROSTER) {
      const def = BRAWLER_DEFS[id]
      expect(def, `missing def for ${id}`).toBeDefined()
      expect(def.sprite, `missing sprite for ${id}`).toBeTruthy()
      expect(def.spriteScale, `missing spriteScale for ${id}`).toBeGreaterThan(0)
      expect(def.superType, `missing superType for ${id}`).toBeTruthy()
      expect(def.superDamage, `missing superDamage for ${id}`).toBeGreaterThan(0)
    }
  })
})

const idle = (over: Partial<BrawlerControl> = {}): BrawlerControl => ({
  moveX: 0,
  moveY: 0,
  moveMag: 0,
  aimAngle: 0,
  firing: false,
  superQueued: false,
  ...over,
})

let b: Brawler
beforeEach(() => {
  b = new Brawler(BRAWLER_DEFS.blaster, 100, 100)
})

describe('Brawler stats', () => {
  it('starts at full health', () => {
    expect(b.hp).toBe(b.maxHp)
    expect(b.alive).toBe(true)
  })

  it('takes damage and dies at zero hp', () => {
    b.takeDamage(1000)
    expect(b.hp).toBe(b.maxHp - 1000)
    expect(b.alive).toBe(true)
    b.takeDamage(b.maxHp)
    expect(b.alive).toBe(false)
    expect(b.hp).toBe(0)
  })

  it('does not take damage after death', () => {
    b.takeDamage(b.maxHp)
    b.takeDamage(500)
    expect(b.hp).toBe(0)
  })

  it('charges super from damage taken', () => {
    b.takeDamage(1000)
    expect(b.superCharge).toBeGreaterThan(0)
  })

  it('clamps super charge at 1', () => {
    b.chargeSuper(3)
    expect(b.superCharge).toBe(1)
  })

  it('heals up to max health without overflowing', () => {
    b.takeDamage(1000)
    b.heal(600)
    expect(b.hp).toBe(b.maxHp - 400)
    b.heal(99999)
    expect(b.hp).toBe(b.maxHp)
  })
})

describe('Brawler super charge', () => {
  it('does not reach a ready super from a single hit taken', () => {
    b.takeDamage(100)
    expect(b.superReady).toBe(false)
  })

  it('reaches a ready super after several hits taken', () => {
    for (let i = 0; i < 13; i++) b.takeDamage(100)
    expect(b.superReady).toBe(true)
  })

  it('does not charge super at all from a killing blow on a dead brawler', () => {
    b.takeDamage(b.maxHp)
    const before = b.superCharge
    b.takeDamage(100)
    expect(b.superCharge).toBe(before)
  })
})

describe('Brawler movement', () => {
  it('moves by speed over dt', () => {
    b.update(1 / 60, idle({ moveX: 1, moveY: 0, moveMag: 1 }))
    expect(b.pos.x).toBeCloseTo(100 + BRAWLER_DEFS.blaster.speed / 60, 3)
    expect(b.pos.y).toBeCloseTo(100, 3)
  })

  it('faces the movement direction, not the aim, when moving', () => {
    b.update(1 / 60, idle({ moveX: 1, moveY: 0, moveMag: 1, aimAngle: Math.PI }))
    expect(b.facing).toBeCloseTo(0, 2)
  })

  it('faces aim direction while firing', () => {
    b.update(1, idle({ aimAngle: Math.PI, firing: true }))
    expect(b.facing).toBeCloseTo(Math.PI, 2)
  })

  it('keeps facing when neither moving nor firing', () => {
    b.facing = 1.5
    b.update(1 / 60, idle({ aimAngle: Math.PI }))
    expect(b.facing).toBeCloseTo(1.5, 2)
  })
})

describe('Brawler firing', () => {
  it('requests a shot when firing and cooldown ready', () => {
    b.update(1 / 60, idle({ firing: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
  })

  it('does not request a shot when not firing', () => {
    b.update(1 / 60, idle())
    expect(b.wantsFireThisFrame()).toBe(false)
  })

  it('respects fire rate cooldown', () => {
    b.update(1 / 60, idle({ firing: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
    b.update(1 / 60, idle({ firing: true }))
    expect(b.wantsFireThisFrame()).toBe(false)
    const rate = BRAWLER_DEFS.blaster.fireRate
    b.update(1 / rate, idle({ firing: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
  })

  it('does not fire while dashing', () => {
    const c = new Brawler(BRAWLER_DEFS.charger, 0, 0)
    c.chargeSuper(1)
    c.update(1 / 60, idle({ superQueued: true }))
    expect(c.dash.active).toBe(true)
    c.update(1 / 60, idle({ firing: true }))
    expect(c.wantsFireThisFrame()).toBe(false)
  })

  it('starts a swing animation when a melee brawler fires', () => {
    const t = new Brawler(BRAWLER_DEFS.tank, 0, 0)
    expect(t.swingT).toBe(0)
    t.update(1 / 60, idle({ firing: true }))
    expect(t.wantsFireThisFrame()).toBe(true)
    expect(t.swingT).toBe(1)
    t.update(1 / 60, idle())
    expect(t.swingT).toBeLessThan(1)
  })
})

describe('Brawler fire-on-release', () => {
  it('requests a single shot when fireOnce is set', () => {
    b.update(1 / 60, idle({ fireOnce: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
  })

  it('does not fire on the frame after fireOnce', () => {
    b.update(1 / 60, idle({ fireOnce: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
    b.update(1 / 60, idle())
    expect(b.wantsFireThisFrame()).toBe(false)
  })

  it('does not fire fireOnce while the cooldown is active', () => {
    b.update(1 / 60, idle({ fireOnce: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
    b.update(1 / 60, idle({ fireOnce: true }))
    expect(b.wantsFireThisFrame()).toBe(false)
    const rate = BRAWLER_DEFS.blaster.fireRate
    b.update(1 / rate, idle({ fireOnce: true }))
    expect(b.wantsFireThisFrame()).toBe(true)
  })

  it('does not fire on release while dashing', () => {
    const c = new Brawler(BRAWLER_DEFS.charger, 0, 0)
    c.chargeSuper(1)
    c.update(1 / 60, idle({ superQueued: true }))
    c.update(1 / 60, idle({ fireOnce: true }))
    expect(c.wantsFireThisFrame()).toBe(false)
  })
})

describe('Brawler super', () => {
  it('starts without a super ready', () => {
    expect(b.superReady).toBe(false)
  })

  it('becomes ready at full charge', () => {
    b.chargeSuper(1)
    expect(b.superReady).toBe(true)
  })

  it('is not ready during super cooldown', () => {
    b.chargeSuper(1)
    b.update(1 / 60, idle({ superQueued: true }))
    expect(b.superCharge).toBe(0)
    expect(b.superReady).toBe(false)
  })

  it('triggers a dash for charger supers', () => {
    const c = new Brawler(BRAWLER_DEFS.charger, 0, 0)
    c.chargeSuper(1)
    c.update(1 / 60, idle({ aimAngle: Math.PI / 2, superQueued: true }))
    expect(c.dash.active).toBe(true)
    expect(c.dash.dirY).toBeCloseTo(1, 5)
    expect(c.superJustTriggered).toBe(true)
  })

  it('signals storm/boulder supers via superJustTriggered', () => {
    b.chargeSuper(1)
    b.update(1 / 60, idle({ superQueued: true }))
    expect(b.superJustTriggered).toBe(true)
    expect(b.dash.active).toBe(false)
  })

  it('dash moves the brawler along its direction', () => {
    const c = new Brawler(BRAWLER_DEFS.charger, 0, 0)
    c.chargeSuper(1)
    c.update(1 / 60, idle({ aimAngle: 0, superQueued: true }))
    const before = c.pos.x
    c.update(1 / 60, idle())
    expect(c.pos.x).toBeGreaterThan(before)
  })

  it('clears superJustTriggered once consumed', () => {
    b.chargeSuper(1)
    b.update(1 / 60, idle({ superQueued: true }))
    expect(b.superJustTriggered).toBe(true)
    b.superJustTriggered = false
    b.update(1 / 60, idle())
    expect(b.superJustTriggered).toBe(false)
  })
})
