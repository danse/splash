import { describe, expect, it } from 'vitest'
import { generateArena } from './arena'
import { rectsOverlap } from './collision'

describe('generateArena', () => {
  it('produces an arena of fixed dimensions', () => {
    const a = generateArena(123, 6)
    expect(a.width).toBe(2400)
    expect(a.height).toBe(2400)
  })

  it('is deterministic for the same seed', () => {
    const a1 = generateArena(999, 6)
    const a2 = generateArena(999, 6)
    expect(a1.walls).toEqual(a2.walls)
    expect(a1.bushes).toEqual(a2.bushes)
    expect(a1.spawnPoints).toEqual(a2.spawnPoints)
  })

  it('places interior walls beyond the border walls', () => {
    const a = generateArena(5, 6)
    expect(a.walls.length).toBeGreaterThan(4)
    const interior = a.walls.filter(
      (w) => w.x >= 0 && w.y >= 0 && w.x + w.w <= a.width && w.y + w.h <= a.height,
    )
    expect(interior.length).toBeGreaterThan(0)
  })

  it('does not spawn interior walls overlapping the border wall zone', () => {
    const a = generateArena(5, 6)
    const interior = a.walls.filter(
      (w) => w.x >= 0 && w.y >= 0 && w.x + w.w <= a.width && w.y + w.h <= a.height,
    )
    for (const w of interior) {
      expect(w.x).toBeGreaterThanOrEqual(20)
      expect(w.y).toBeGreaterThanOrEqual(20)
      expect(w.x + w.w).toBeLessThanOrEqual(a.width - 20)
      expect(w.y + w.h).toBeLessThanOrEqual(a.height - 20)
    }
  })

  it('differs across seeds', () => {
    const a1 = generateArena(1, 6)
    const a2 = generateArena(2, 6)
    expect(a1.walls).not.toEqual(a2.walls)
    expect(a1.bushes).not.toEqual(a2.bushes)
  })

  it('creates one spawn point per player', () => {
    const a = generateArena(5, 6)
    expect(a.spawnPoints).toHaveLength(6)
  })

  it('keeps all spawn points inside the arena', () => {
    const a = generateArena(5, 6)
    for (const p of a.spawnPoints) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(a.width)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(a.height)
    }
  })

  it('keeps the center clear for pickups (no walls near it)', () => {
    const a = generateArena(5, 6)
    const center = { x: a.width / 2, y: a.height / 2 }
    const keepClear = { x: center.x - 340, y: center.y - 340, w: 680, h: 680 }
    for (const w of a.walls) {
      expect(rectsOverlap(w, keepClear, 90)).toBe(false)
    }
  })

  it('places power spots inside the arena', () => {
    const a = generateArena(5, 6)
    expect(a.powerSpots).toHaveLength(4)
    for (const p of a.powerSpots) {
      expect(p.x).toBeGreaterThan(100)
      expect(p.x).toBeLessThan(a.width - 100)
      expect(p.y).toBeGreaterThan(100)
      expect(p.y).toBeLessThan(a.height - 100)
    }
  })

  it('produces consistent bush placement across runs with the same seed', () => {
    const a1 = generateArena(7, 4)
    const a2 = generateArena(7, 4)
    expect(a1.bushes).toEqual(a2.bushes)
  })
})
