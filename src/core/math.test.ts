import { describe, expect, it } from 'vitest'
import { clamp, lerp, angleLerp, easeOutCubic, easeOutBack, mulberry32, TAU, randInt } from './math'

describe('clamp', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(lerp(0, 10, 1)).toBe(10)
  })
})

describe('angleLerp', () => {
  it('takes the short way around the circle', () => {
    expect(angleLerp(0, TAU - 0.1, 1)).toBeCloseTo(-0.1, 5)
    expect(angleLerp(0, Math.PI, 1)).toBeCloseTo(Math.PI, 5)
    expect(angleLerp(1, 1.5, 1)).toBeCloseTo(1.5, 5)
    expect(angleLerp(0, 1, 0)).toBe(0)
  })
})

describe('easing', () => {
  it('easeOutCubic stays in [0,1]', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5)
  })

  it('easeOutBack overshoots past 1', () => {
    expect(easeOutBack(1)).toBeCloseTo(1, 5)
    expect(easeOutBack(0.5)).toBeGreaterThan(0.5)
  })
})

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('produces values in [0,1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('differs across seeds', () => {
    const a = mulberry32(1)()
    const b = mulberry32(2)()
    expect(a).not.toBe(b)
  })
})

describe('randInt', () => {
  it('stays within bounds', () => {
    for (let i = 0; i < 200; i++) {
      const v = randInt(2, 5)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
    }
  })
})
