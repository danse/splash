// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { Input } from '../core/input'
import { Hud } from './hud'

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

let input: Input
let exitCalls: number

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  input = new Input()
  exitCalls = 0
  new Hud(input, () => exitCalls++)
})

describe('Hud super joystick', () => {
  it('tracks the drag angle live and fires a drag-aimed super on release', () => {
    const btn = document.querySelector('.super-btn') as HTMLButtonElement
    btn.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    window.dispatchEvent(makePointerEvent('pointermove', { pointerId: 1, clientX: 60, clientY: 60 }))

    expect(input.superAim.active).toBe(true)
    expect(input.superAim.angle).toBeCloseTo(Math.PI / 4, 5)

    window.dispatchEvent(makePointerEvent('pointerup', { pointerId: 1 }))
    expect(input.superAim.active).toBe(false)
    expect(input.consumeSuper()).toEqual({ queued: true, angle: Math.PI / 4 })
  })

  it('fires a tap super with no angle (closest enemy)', () => {
    const btn = document.querySelector('.super-btn') as HTMLButtonElement
    btn.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    window.dispatchEvent(makePointerEvent('pointerup', { pointerId: 1 }))
    expect(input.consumeSuper()).toEqual({ queued: true, angle: null })
  })

  it('does not fire on pointercancel', () => {
    const btn = document.querySelector('.super-btn') as HTMLButtonElement
    btn.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    window.dispatchEvent(makePointerEvent('pointercancel', { pointerId: 1 }))
    expect(input.consumeSuper()).toEqual({ queued: false, angle: null })
  })

  it('clears the live aim state on pointercancel', () => {
    const btn = document.querySelector('.super-btn') as HTMLButtonElement
    btn.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    window.dispatchEvent(makePointerEvent('pointermove', { pointerId: 1, clientX: 60, clientY: 0 }))
    expect(input.superAim.active).toBe(true)
    window.dispatchEvent(makePointerEvent('pointercancel', { pointerId: 1 }))
    expect(input.superAim.active).toBe(false)
  })
})
