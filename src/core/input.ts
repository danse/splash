import { clamp } from './math'

export interface Stick {
  active: boolean
  id: number
  ox: number
  oy: number
  x: number
  y: number
  dx: number
  dy: number
  mag: number
}

export interface InputState {
  move: Stick
  aim: Stick
}

const DEADZONE = 8
const MAX_REACH = 62
const TAP_MS = 220

const emptyStick = (): Stick => ({
  active: false,
  id: -1,
  ox: 0,
  oy: 0,
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  mag: 0,
})

export class Input {
  state: InputState = {
    move: emptyStick(),
    aim: emptyStick(),
  }

  private el: HTMLDivElement
  private moveBase: HTMLDivElement
  private moveKnob!: HTMLDivElement
  private aimBase: HTMLDivElement
  private aimKnob!: HTMLDivElement
  private superQueued = false
  private superAngle: number | null = null
  superAim = { active: false, angle: 0 }
  private aimTapQueued = false
  private aimDownAt = 0
  private aimDragged = false

  constructor() {
    this.el = document.getElementById('app') as HTMLDivElement

    this.moveBase = this.makeStick('move')
    this.aimBase = this.makeStick('aim')

    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private makeStick(which: 'move' | 'aim'): HTMLDivElement {
    const base = document.createElement('div')
    base.className = `joy-base ${which} hidden`
    const knob = document.createElement('div')
    knob.className = 'joy-knob'
    base.appendChild(knob)
    this.el.appendChild(base)
    if (which === 'move') this.moveKnob = knob
    else this.aimKnob = knob
    return base
  }

  private onPointerDown = (e: PointerEvent): void => {
    const id = e.pointerId
    const x = e.clientX
    const y = e.clientY

    const stick = this.stickForTouch(x)
    if (!stick) return
    this.activateStick(stick, id, x, y, x, y)
    this.paintStick(stick)
  }

  private onPointerMove = (e: PointerEvent): void => {
    const id = e.pointerId
    const stick = this.stickById(id)
    if (!stick) return
    this.updateStick(stick, e.clientX, e.clientY)
  }

  private onPointerUp = (e: PointerEvent): void => {
    const stick = this.stickById(e.pointerId)
    if (!stick) return
    this.releaseStick(stick)
  }

  private stickForTouch(x: number): Stick | null {
    const width = window.innerWidth
    const left = x < width * 0.5
    if (left && !this.state.move.active) return this.state.move
    if (!left && !this.state.aim.active) return this.state.aim
    if (!this.state.move.active) return this.state.move
    if (!this.state.aim.active) return this.state.aim
    return null
  }

  private stickById(id: number): Stick | null {
    if (this.state.move.active && this.state.move.id === id) return this.state.move
    if (this.state.aim.active && this.state.aim.id === id) return this.state.aim
    return null
  }

  private activateStick(stick: Stick, id: number, ox: number, oy: number, x: number, y: number): void {
    stick.active = true
    stick.id = id
    stick.ox = ox
    stick.oy = oy
    this.updateStick(stick, x, y)
    if (stick === this.state.aim) {
      this.aimDownAt = performance.now()
      this.aimDragged = false
    }
  }

  private updateStick(stick: Stick, x: number, y: number): void {
    let dx = x - stick.ox
    let dy = y - stick.oy
    let mag = Math.hypot(dx, dy)
    if (mag > MAX_REACH) {
      dx = (dx / mag) * MAX_REACH
      dy = (dy / mag) * MAX_REACH
      x = stick.ox + dx
      y = stick.oy + dy
      mag = MAX_REACH
    }
    if (mag < DEADZONE) {
      dx = 0
      dy = 0
      mag = 0
    } else {
      mag = (mag - DEADZONE) / (MAX_REACH - DEADZONE)
    }
    stick.x = x
    stick.y = y
    stick.dx = dx
    stick.dy = dy
    stick.mag = clamp(mag, 0, 1)
    if (stick === this.state.aim && (dx !== 0 || dy !== 0)) this.aimDragged = true
    this.paintStick(stick)
  }

  private stickDom(stick: Stick): { base: HTMLDivElement; knob: HTMLDivElement } {
    return stick === this.state.move
      ? { base: this.moveBase, knob: this.moveKnob }
      : { base: this.aimBase, knob: this.aimKnob }
  }

  private releaseStick(stick: Stick): void {
    stick.active = false
    stick.id = -1
    stick.dx = 0
    stick.dy = 0
    stick.mag = 0
    const { base } = this.stickDom(stick)
    base.classList.add('hidden')
    if (stick === this.state.aim && !this.aimDragged && performance.now() - this.aimDownAt < TAP_MS) {
      this.aimTapQueued = true
    }
  }

  private paintQueued = false
  private paintMove: Stick | null = null
  private paintAim: Stick | null = null

  private paintStick(stick: Stick): void {
    if (stick === this.state.move) this.paintMove = stick
    else this.paintAim = stick
    if (this.paintQueued) return
    this.paintQueued = true
    requestAnimationFrame(() => {
      this.paintQueued = false
      const move = this.paintMove
      const aim = this.paintAim
      this.paintMove = null
      this.paintAim = null
      if (move) this.applyPaint(move)
      if (aim) this.applyPaint(aim)
    })
  }

  private applyPaint(stick: Stick): void {
    if (!stick.active) return
    const { base, knob } = this.stickDom(stick)
    base.classList.remove('hidden')
    base.style.left = `${stick.ox - 64}px`
    base.style.top = `${stick.oy - 64}px`
    const kx = (stick.dx / MAX_REACH) * 64
    const ky = (stick.dy / MAX_REACH) * 64
    knob.style.transform = `translate3d(calc(-50% + ${kx}px), calc(-50% + ${ky}px), 0)`
  }

  moveVec(): { x: number; y: number; mag: number } {
    if (this.state.move.active && this.state.move.mag > 0) {
      const mag = this.state.move.mag
      const mx = (this.state.move.dx / MAX_REACH) * mag
      const my = (this.state.move.dy / MAX_REACH) * mag
      return { x: mx, y: my, mag }
    }
    return { x: 0, y: 0, mag: 0 }
  }

  queueSuper(angle?: number): void {
    this.superQueued = true
    this.superAngle = angle ?? null
  }

  beginSuperAim(): void {
    this.superAim.active = true
    this.superAim.angle = 0
  }

  aimSuper(angle: number): void {
    this.superAim.angle = angle
  }

  endSuperAim(): void {
    this.superAim.active = false
  }

  consumeSuper(): { queued: boolean; angle: number | null } {
    if (this.superQueued) {
      this.superQueued = false
      const angle = this.superAngle
      this.superAngle = null
      return { queued: true, angle }
    }
    return { queued: false, angle: null }
  }

  consumeAimTap(): boolean {
    if (this.aimTapQueued) {
      this.aimTapQueued = false
      return true
    }
    return false
  }
}
