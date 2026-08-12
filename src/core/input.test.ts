// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { Input } from './input'

function makePointerEvent(type: string, props: Record<string, unknown>): Event {
  const e = new Event(type, { bubbles: true }) as unknown as Record<string, unknown>
  Object.assign(e, {
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    pointerType: 'touch',
    button: 0,
    ...props,
  })
  return e as unknown as PointerEvent
}

function touchDown(x: number, y: number, id = 1): void {
  window.dispatchEvent(makePointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: id, pointerType: 'touch' }))
}

function touchMove(x: number, y: number, id = 1): void {
  window.dispatchEvent(makePointerEvent('pointermove', { clientX: x, clientY: y, pointerId: id, pointerType: 'touch' }))
}

function touchUp(id = 1): void {
  window.dispatchEvent(makePointerEvent('pointerup', { pointerId: id, pointerType: 'touch' }))
}

let input: Input
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  input = new Input()
})

describe('Input multitouch', () => {
  it('assigns a left-half touch to the move stick', () => {
    touchDown(200, 400, 1)
    expect(input.state.move.active).toBe(true)
    expect(input.state.move.ox).toBe(200)
    expect(input.state.move.oy).toBe(400)
    expect(input.state.aim.active).toBe(false)
  })

  it('assigns a right-half touch to the aim stick simultaneously', () => {
    touchDown(200, 400, 1)
    touchDown(800, 500, 2)
    expect(input.state.move.active).toBe(true)
    expect(input.state.aim.active).toBe(true)
    expect(input.state.aim.id).toBe(2)
  })

  it('tracks independent stick movement', () => {
    touchDown(200, 400, 1)
    touchMove(250, 400, 1)
    touchDown(800, 500, 2)
    touchMove(800, 550, 2)
    expect(input.state.move.dx).toBeGreaterThan(0)
    expect(input.state.move.dy).toBe(0)
    expect(input.state.aim.dy).toBeGreaterThan(0)
    expect(input.state.aim.dx).toBe(0)
  })

  it('applies a deadzone to small deflections', () => {
    touchDown(200, 400, 1)
    touchMove(203, 400, 1)
    expect(input.state.move.mag).toBe(0)
  })

  it('clamps stick displacement to max reach', () => {
    touchDown(200, 400, 1)
    touchMove(500, 400, 1)
    expect(Math.abs(input.state.move.dx)).toBeLessThanOrEqual(62.0001)
  })

  it('normalizes magnitude into [0,1]', () => {
    touchDown(200, 400, 1)
    touchMove(262, 400, 1)
    expect(input.state.move.mag).toBeGreaterThan(0)
    expect(input.state.move.mag).toBeLessThanOrEqual(1)
  })

  it('releases the stick on pointerup', () => {
    touchDown(200, 400, 1)
    touchUp(1)
    expect(input.state.move.active).toBe(false)
    expect(input.state.move.mag).toBe(0)
  })

  it('moveVec reflects the move stick', () => {
    touchDown(200, 400, 1)
    touchMove(262, 400, 1)
    const v = input.moveVec()
    expect(v.x).toBeGreaterThan(0)
    expect(Math.abs(v.y)).toBeLessThan(0.001)
  })
})

describe('Input super', () => {
  it('queues and consumes the super exactly once', () => {
    input.queueSuper()
    expect(input.consumeSuper()).toEqual({ queued: true, angle: null })
    expect(input.consumeSuper()).toEqual({ queued: false, angle: null })
  })

  it('carries an explicit aim angle for drag-aimed supers', () => {
    input.queueSuper(Math.PI / 4)
    expect(input.consumeSuper()).toEqual({ queued: true, angle: Math.PI / 4 })
  })

  it('clears the stored aim angle once consumed', () => {
    input.queueSuper(1)
    input.consumeSuper()
    expect(input.consumeSuper()).toEqual({ queued: false, angle: null })
  })
})

describe('Input super aim', () => {
  it('tracks the live aim angle while the super joystick is held', () => {
    expect(input.superAim.active).toBe(false)
    input.beginSuperAim()
    expect(input.superAim.active).toBe(true)
    expect(input.superAim.angle).toBe(0)
    input.aimSuper(Math.PI / 3)
    expect(input.superAim.angle).toBeCloseTo(Math.PI / 3, 5)
    input.endSuperAim()
    expect(input.superAim.active).toBe(false)
  })
})

describe('Input aim tap', () => {
  it('queues a tap when the aim stick is tapped without dragging', () => {
    touchDown(800, 500, 2)
    touchUp(2)
    expect(input.consumeAimTap()).toBe(true)
    expect(input.consumeAimTap()).toBe(false)
  })

  it('does not queue a tap after dragging the aim stick', () => {
    touchDown(800, 500, 2)
    touchMove(860, 560, 2)
    touchUp(2)
    expect(input.consumeAimTap()).toBe(false)
  })

  it('does not queue a tap when the stick is held past the tap window', () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance'] })
    try {
      touchDown(800, 500, 2)
      vi.advanceTimersByTime(300)
      touchUp(2)
      expect(input.consumeAimTap()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not treat a move-stick tap as an aim tap', () => {
    touchDown(200, 400, 1)
    touchUp(1)
    expect(input.consumeAimTap()).toBe(false)
  })
})
