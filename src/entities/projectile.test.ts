import { describe, expect, it } from 'vitest'
import { spawnProjectile } from './projectile'
import { Brawler, BRAWLER_DEFS } from './brawler'

describe('spawnProjectile', () => {
  it('spawns at the muzzle, just outside the owner radius', () => {
    const owner = new Brawler(BRAWLER_DEFS.blaster, 100, 200)
    const p = spawnProjectile(owner, 0, 1000, 500, 100, 10, '#fff', true, false)
    expect(p.x).toBeCloseTo(100 + owner.r + 10, 5)
    expect(p.y).toBeCloseTo(200, 5)
  })

  it('respects the launch angle', () => {
    const owner = new Brawler(BRAWLER_DEFS.blaster, 0, 0)
    const p = spawnProjectile(owner, Math.PI / 2, 1000, 500, 100, 10, '#fff', true, false)
    expect(p.y).toBeGreaterThan(0)
    expect(Math.abs(p.x)).toBeLessThan(1e-9)
  })

  it('sets velocity from speed and angle', () => {
    const owner = new Brawler(BRAWLER_DEFS.blaster, 0, 0)
    const p = spawnProjectile(owner, Math.PI, 800, 400, 50, 10, '#fff', true, false)
    expect(p.vx).toBeCloseTo(-800, 5)
    expect(p.vy).toBeCloseTo(0, 5)
  })

  it('sets lifetime from range and speed', () => {
    const owner = new Brawler(BRAWLER_DEFS.blaster, 0, 0)
    const p = spawnProjectile(owner, 0, 1000, 500, 50, 10, '#fff', true, false)
    expect(p.ttl).toBeCloseTo(0.5, 5)
  })

  it('tags friendliness and super status', () => {
    const owner = new Brawler(BRAWLER_DEFS.blaster, 0, 0)
    const p = spawnProjectile(owner, 0, 1000, 500, 50, 10, '#fff', false, true)
    expect(p.friendly).toBe(false)
    expect(p.isSuper).toBe(true)
    expect(p.owner).toBe(owner)
  })

  it('honors pierce count', () => {
    const owner = new Brawler(BRAWLER_DEFS.tank, 0, 0)
    const p = spawnProjectile(owner, 0, 1000, 500, 50, 10, '#fff', true, true, 3)
    expect(p.pierce).toBe(3)
  })
})
