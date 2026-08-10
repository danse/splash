import { describe, expect, it } from 'vitest'
import {
  circleRectCollide,
  pushOutOfRect,
  resolveCircle,
  rectsOverlap,
  circleInRect,
  Rect,
} from './collision'

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })

describe('circleRectCollide', () => {
  it('detects a circle overlapping a rect', () => {
    expect(circleRectCollide({ x: 60, y: 60, r: 10 }, rect(50, 50, 100, 100))).toBe(true)
  })

  it('detects edge contact', () => {
    expect(circleRectCollide({ x: 60, y: 60, r: 10 }, rect(50, 50, 100, 100))).toBe(true)
  })

  it('returns false when fully separated', () => {
    expect(circleRectCollide({ x: 5, y: 5, r: 10 }, rect(50, 50, 100, 100))).toBe(false)
    expect(circleRectCollide({ x: 100, y: 0, r: 10 }, rect(50, 50, 100, 100))).toBe(false)
  })
})

describe('pushOutOfRect', () => {
  it('pushes a circle fully out of a rect', () => {
    const c = { x: 75, y: 75, r: 10 }
    pushOutOfRect(c, rect(50, 50, 100, 100))
    expect(circleRectCollide(c, rect(50, 50, 100, 100))).toBe(false)
  })

  it('pushes out in the direction of least penetration', () => {
    const c = { x: 50, y: 75, r: 10 }
    pushOutOfRect(c, rect(50, 50, 100, 100))
    expect(c.x).toBeLessThan(50)
    expect(c.y).toBeCloseTo(75, 5)
  })

  it('does not move a non-colliding circle', () => {
    const c = { x: 0, y: 0, r: 10 }
    pushOutOfRect(c, rect(50, 50, 100, 100))
    expect(c.x).toBe(0)
    expect(c.y).toBe(0)
  })
})

describe('resolveCircle', () => {
  it('resolves overlap against multiple rects at once', () => {
    const walls = [rect(0, 0, 20, 200), rect(0, 0, 200, 20)]
    const c = { x: 10, y: 10, r: 8 }
    resolveCircle(walls, c)
    expect(circleRectCollide(c, walls[0])).toBe(false)
    expect(circleRectCollide(c, walls[1])).toBe(false)
  })

  it('is idempotent once resolved', () => {
    const walls = [rect(0, 0, 20, 200)]
    const c = { x: 10, y: 50, r: 8 }
    resolveCircle(walls, c)
    const before = { ...c }
    resolveCircle(walls, c)
    expect(c.x).toBeCloseTo(before.x, 5)
    expect(c.y).toBeCloseTo(before.y, 5)
  })
})

describe('rectsOverlap', () => {
  it('detects overlap', () => {
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true)
  })

  it('respects padding', () => {
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(12, 0, 10, 10), 2)).toBe(true)
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(12, 0, 10, 10), 0)).toBe(false)
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(20, 0, 10, 10), 6)).toBe(true)
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(20, 0, 10, 10), 4)).toBe(false)
  })
})

describe('circleInRect', () => {
  it('checks containment', () => {
    expect(circleInRect({ x: 5, y: 5, r: 1 }, rect(0, 0, 10, 10))).toBe(true)
    expect(circleInRect({ x: 0, y: 5, r: 1 }, rect(0, 0, 10, 10))).toBe(false)
  })
})
