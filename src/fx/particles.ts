import { rand, TAU } from '../core/math'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  drag: number
  grav: number
  rot: number
  vr: number
  kind: 'spark' | 'shard' | 'ring'
}

interface FloatText {
  x: number
  y: number
  value: string
  life: number
  maxLife: number
  color: string
  size: number
}

const POOL = 900

export class FX {
  private parts: Particle[] = []
  private floats: FloatText[] = []
  private time = 0

  update(dt: number): void {
    this.time += dt
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.life -= dt
      if (p.life <= 0) {
        this.parts.splice(i, 1)
        continue
      }
      const drag = Math.pow(p.drag, dt * 60)
      p.vx *= drag
      p.vy *= drag
      p.vy += p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]
      f.life -= dt
      f.y -= 46 * dt
      if (f.life <= 0) this.floats.splice(i, 1)
    }
    if (this.parts.length > POOL) this.parts.length = POOL
  }

  private add(p: Particle): void {
    if (this.parts.length < POOL) this.parts.push(p)
  }

  burst(x: number, y: number, color: string, count: number, speed = 260, size = 6, kind: 'spark' | 'shard' = 'spark'): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU)
      const s = rand(speed * 0.3, speed)
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.6),
        maxLife: 0.6,
        size: rand(size * 0.5, size * 1.4),
        color,
        drag: 0.9,
        grav: 0,
        rot: rand(0, TAU),
        vr: rand(-6, 6),
        kind,
      })
    }
  }

  ring(x: number, y: number, color: string, maxSize: number): void {
    this.add({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35,
      maxLife: 0.35,
      size: maxSize,
      color,
      drag: 1,
      grav: 0,
      rot: 0,
      vr: 0,
      kind: 'ring',
    })
  }

  muzzle(x: number, y: number, angle: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      const a = angle + rand(-0.4, 0.4)
      const s = rand(120, 420)
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.1, 0.25),
        maxLife: 0.25,
        size: rand(2.5, 6),
        color,
        drag: 0.82,
        grav: 0,
        rot: 0,
        vr: 0,
        kind: 'spark',
      })
    }
  }

  explosion(x: number, y: number, color: string): void {
    this.burst(x, y, color, 26, 460, 9, 'spark')
    this.burst(x, y, '#ffffff', 10, 300, 6, 'spark')
    this.ring(x, y, color, 120)
    this.ring(x, y, '#ffffff', 70)
  }

  hitSpark(x: number, y: number, color: string): void {
    this.burst(x, y, color, 7, 200, 5, 'spark')
  }

  floatText(x: number, y: number, value: string, color: string, size = 26, crit = false): void {
    if (this.floats.length > 40) this.floats.shift()
    this.floats.push({
      x,
      y,
      value,
      life: crit ? 0.95 : 0.7,
      maxLife: crit ? 0.95 : 0.7,
      color,
      size,
    })
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const t = p.life / p.maxLife
      if (p.kind === 'ring') {
        const progress = 1 - t
        ctx.globalAlpha = t * 0.85
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(1, 6 * t)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.4 + progress * 1.2), 0, TAU)
        ctx.stroke()
        continue
      }
      ctx.globalAlpha = Math.min(1, t * 1.5)
      ctx.fillStyle = p.color
      if (p.kind === 'shard') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        const s = p.size
        ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9)
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, TAU)
        ctx.fill()
      }
    }
    for (const f of this.floats) {
      const t = f.life / f.maxLife
      ctx.globalAlpha = Math.min(1, t * 2)
      ctx.font = `900 ${f.size}px 'Segoe UI', sans-serif`
      ctx.textAlign = 'center'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 5
      ctx.strokeText(f.value, f.x, f.y)
      ctx.fillStyle = f.color
      ctx.fillText(f.value, f.x, f.y)
    }
    ctx.globalAlpha = 1
  }
}
