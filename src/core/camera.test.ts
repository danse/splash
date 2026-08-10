import { describe, expect, it } from 'vitest'
import { Camera } from './camera'

describe('Camera viewport', () => {
  it('rescales when the width changes (orientation / window resize)', () => {
    const cam = new Camera()
    cam.setViewport(800, 400)
    expect(cam.scale).toBeCloseTo(0.4, 5)
    cam.setViewport(1000, 500)
    expect(cam.scale).toBeCloseTo(0.5, 5)
  })

  it('keeps the scale on height-only churn (mobile URL bar)', () => {
    const cam = new Camera()
    cam.setViewport(800, 400)
    cam.setViewport(800, 460)
    expect(cam.scale).toBeCloseTo(0.4, 5)
  })

  it('rescales on a large height-only change', () => {
    const cam = new Camera()
    cam.setViewport(800, 400)
    cam.setViewport(800, 560)
    expect(cam.scale).toBeCloseTo(0.56, 5)
  })
})

describe('Camera clamp', () => {
  it('clamps to bounds using the stored viewport', () => {
    const cam = new Camera()
    cam.setViewport(800, 400)
    cam.follow({ pos: { x: 2000, y: 2000 } }, { x: 0, y: 0, w: 2400, h: 2400 })
    for (let i = 0; i < 100; i++) cam.update(1 / 60)
    expect(cam.x).toBeCloseTo(1400, 3)
    expect(cam.y).toBeCloseTo(1900, 3)
  })
})

describe('Camera shake', () => {
  it('is zero when trauma is zero', () => {
    const cam = new Camera()
    expect(cam.shakeX).toBe(0)
    expect(cam.shakeY).toBe(0)
  })

  it('zeroes out below the dead zone', () => {
    const cam = new Camera()
    cam.shake(0.005)
    cam.update(1 / 60)
    expect(cam.traumaLevel()).toBe(0)
    expect(cam.shakeX).toBe(0)
    expect(cam.shakeY).toBe(0)
  })

  it('stays within the expected amplitude', () => {
    const cam = new Camera()
    cam.shake(1)
    cam.update(1 / 60)
    expect(Math.abs(cam.shakeX)).toBeLessThanOrEqual(26)
    expect(Math.abs(cam.shakeY)).toBeLessThanOrEqual(26)
  })

  it('is smooth across frames (no white-noise jumps)', () => {
    const cam = new Camera()
    cam.shake(1)
    cam.update(1 / 60)
    const a = cam.shakeX
    cam.update(1 / 60)
    const b = cam.shakeX
    expect(Math.abs(b - a)).toBeLessThan(20)
  })
})

describe('Camera pixel snap', () => {
  it('snaps the horizontal camera offset to device pixels', () => {
    const cam = new Camera()
    cam.setViewport(900, 400)
    cam.scale = 0.4
    cam.x = 1125.3
    cam.y = 800.7
    const dpr = 2
    expect((cam.snapX(dpr) * cam.scale - cam.viewW / 2) * dpr % 1).toBeCloseTo(0, 5)
    expect((cam.snapY(dpr) * cam.scale - cam.viewH / 2) * dpr % 1).toBeCloseTo(0, 5)
  })

  it('stays within half a device pixel of the raw camera position', () => {
    const cam = new Camera()
    cam.setViewport(900, 400)
    cam.scale = 0.4
    cam.x = 1125.3
    cam.y = 800.7
    const dpr = 2
    expect(Math.abs(cam.snapX(dpr) - cam.x)).toBeLessThan(0.5 / (cam.scale * dpr))
    expect(Math.abs(cam.snapY(dpr) - cam.y)).toBeLessThan(0.5 / (cam.scale * dpr))
  })
})
