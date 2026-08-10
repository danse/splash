export class EndGate {
  private remaining: number
  private firedState = false

  constructor(private readonly delay: number) {
    this.remaining = delay
  }

  get fired(): boolean {
    return this.firedState
  }

  tick(dt: number): boolean {
    if (this.firedState) return false
    this.remaining -= dt
    if (this.remaining > 0) return false
    this.firedState = true
    return true
  }

  reset(): void {
    this.remaining = this.delay
    this.firedState = false
  }
}
