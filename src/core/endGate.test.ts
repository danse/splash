import { describe, expect, it } from 'vitest'
import { EndGate } from './endGate'

describe('EndGate', () => {
  it('returns false until the delay elapses', () => {
    const g = new EndGate(2)
    expect(g.tick(0.5)).toBe(false)
    expect(g.tick(1)).toBe(false)
  })

  it('fires true exactly once when the delay elapses', () => {
    const g = new EndGate(2)
    g.tick(1)
    g.tick(0.5)
    expect(g.tick(0.5)).toBe(true)
    expect(g.tick(1)).toBe(false)
    expect(g.tick(2)).toBe(false)
  })

  it('stays silent forever after firing, no matter how much time passes', () => {
    const g = new EndGate(0.5)
    expect(g.tick(0.5)).toBe(true)
    for (let i = 0; i < 50; i++) {
      expect(g.tick(10)).toBe(false)
    }
  })

  it('reports fired state', () => {
    const g = new EndGate(1)
    expect(g.fired).toBe(false)
    g.tick(1)
    expect(g.fired).toBe(true)
  })

  it('reset re-arms the countdown so it can fire again', () => {
    const g = new EndGate(1)
    g.tick(1)
    g.reset()
    expect(g.fired).toBe(false)
    expect(g.tick(0.5)).toBe(false)
    expect(g.tick(0.5)).toBe(true)
  })
})
