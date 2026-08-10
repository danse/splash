import { clamp, lerp } from './math'

export class Camera {
  x = 0
  y = 0
  scale = 1
  private trauma = 0
  private target: { pos: { x: number; y: number } } | null = null
  private bounds: { x: number; y: number; w: number; h: number } | null = null

  setViewport(_w: number, h: number): void {
    this.scale = h / 1000
  }

  follow(target: { pos: { x: number; y: number } }, bounds?: { x: number; y: number; w: number; h: number }): void {
    this.target = target
    if (bounds) this.bounds = bounds
  }

  shake(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1)
  }

  traumaLevel(): number {
    return this.trauma
  }

  update(dt: number): void {
    if (this.target) {
      const k = 1 - Math.pow(0.0015, dt)
      this.x = lerp(this.x, this.target.pos.x, k)
      this.y = lerp(this.y, this.target.pos.y, k)
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.4)
    if (this.bounds) this.clampToBounds()
  }

  private clampToBounds(): void {
    if (!this.bounds) return
    const hw = window.innerWidth / 2 / this.scale
    const hh = window.innerHeight / 2 / this.scale
    const { x, y, w, h } = this.bounds
    this.x = clamp(this.x, x + hw, x + w - hw)
    this.y = clamp(this.y, y + hh, y + h - hh)
  }

  get shakeX(): number {
    return (Math.random() - 0.5) * this.trauma * 26 * this.trauma
  }

  get shakeY(): number {
    return (Math.random() - 0.5) * this.trauma * 26 * this.trauma
  }
}
