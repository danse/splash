export type UpdateFn = (dt: number) => void

export class GameLoop {
  private raf = 0
  private last = 0
  private accumulator = 0
  private readonly fixedStep = 1 / 120
  running = false

  constructor(private update: UpdateFn) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.accumulator = 0
    this.raf = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private tick = (now: number): void => {
    if (!this.running) return
    let frame = now - this.last
    this.last = now
    if (frame > 100) frame = 100
    this.accumulator += frame / 1000

    const maxSteps = 8
    let steps = 0
    while (this.accumulator >= this.fixedStep && steps < maxSteps) {
      this.update(this.fixedStep)
      this.accumulator -= this.fixedStep
      steps++
    }
    if (steps === maxSteps) this.accumulator = 0

    this.raf = requestAnimationFrame(this.tick)
  }
}
