import { clamp, lerp } from './math'

const MIN_RESIZE_WIDTH = 2
const BIG_HEIGHT_RATIO = 0.3

export class Camera {
  x = 0
  y = 0
  scale = 1
  viewW = 0
  viewH = 0
  private target: { pos: { x: number; y: number } } | null = null
  private bounds: { x: number; y: number; w: number; h: number } | null = null

  setViewport(w: number, h: number): void {
    const widthChanged = Math.abs(w - this.viewW) >= MIN_RESIZE_WIDTH
    const bigHeightChange = this.viewH > 0 && Math.abs(h - this.viewH) / this.viewH >= BIG_HEIGHT_RATIO
    this.viewW = w
    this.viewH = h
    if (widthChanged || bigHeightChange) {
      this.scale = h / 1000
    }
  }

  follow(target: { pos: { x: number; y: number } }, bounds?: { x: number; y: number; w: number; h: number }): void {
    this.target = target
    if (bounds) this.bounds = bounds
  }

  get targetPos(): { pos: { x: number; y: number } } | null {
    return this.target
  }

  update(dt: number): void {
    if (this.target) {
      const k = 1 - Math.pow(0.0015, dt)
      this.x = lerp(this.x, this.target.pos.x, k)
      this.y = lerp(this.y, this.target.pos.y, k)
    }
    if (this.bounds) this.clampToBounds()
  }

  snapX(dpr: number): number {
    const raw = this.x * this.scale - this.viewW / 2
    const snapped = Math.round(raw * dpr) / dpr
    return (snapped + this.viewW / 2) / this.scale
  }

  snapY(dpr: number): number {
    const raw = this.y * this.scale - this.viewH / 2
    const snapped = Math.round(raw * dpr) / dpr
    return (snapped + this.viewH / 2) / this.scale
  }

  private clampToBounds(): void {
    if (!this.bounds) return
    const { x, y, w, h } = this.bounds
    const hw = this.viewW / 2 / this.scale
    const hh = this.viewH / 2 / this.scale
    this.x = w / 2 >= hw ? clamp(this.x, x + hw, x + w - hw) : x + w / 2
    this.y = h / 2 >= hh ? clamp(this.y, y + hh, y + h - hh) : y + h / 2
  }
}
