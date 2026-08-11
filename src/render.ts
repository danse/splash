import { Arena } from './world/arena'
import { Brawler } from './entities/brawler'
import { Projectile } from './entities/projectile'
import { Pickup } from './entities/pickup'
import { Rect } from './world/collision'
import { TAU, easeOutCubic } from './core/math'

export interface RenderOpts {
  walls: Rect[]
  showHealthBars: boolean
}

export function drawArena(ctx: CanvasRenderingContext2D, arena: Arena, includeBushes = true): void {
  const { width: w, height: h } = arena

  ctx.fillStyle = '#141a29'
  ctx.fillRect(0, 0, w, h)

  const tile = 80
  for (let ty = 0; ty < h / tile; ty++) {
    for (let tx = 0; tx < w / tile; tx++) {
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)'
        ctx.fillRect(tx * tile, ty * tile, tile, tile)
      }
    }
  }

  ctx.strokeStyle = 'rgba(120,150,210,0.07)'
  ctx.lineWidth = 1
  for (let gx = 0; gx <= w; gx += tile * 2) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, h)
    ctx.stroke()
  }
  for (let gy = 0; gy <= h; gy += tile * 2) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(w, gy)
    ctx.stroke()
  }

  if (includeBushes) {
    for (const b of arena.bushes) {
      drawBush(ctx, b)
    }
  }

  for (const w of arena.walls) {
    drawWall(ctx, w)
  }
}

export function drawBushes(ctx: CanvasRenderingContext2D, arena: Arena): void {
  for (const b of arena.bushes) {
    drawBush(ctx, b)
  }
}

function drawBush(ctx: CanvasRenderingContext2D, b: Rect): void {
  const grad = ctx.createRadialGradient(
    b.x + b.w / 2,
    b.y + b.h / 2,
    10,
    b.x + b.w / 2,
    b.y + b.h / 2,
    Math.max(b.w, b.h) * 0.7,
  )
  grad.addColorStop(0, 'rgba(38,150,80,0.55)')
  grad.addColorStop(1, 'rgba(22,90,52,0.28)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, TAU)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 9; i++) {
    const px = b.x + 8 + ((i * 37) % (b.w - 16))
    const py = b.y + 8 + ((i * 53) % (b.h - 16))
    ctx.beginPath()
    ctx.arc(px, py, 4, 0, TAU)
    ctx.fill()
  }
}

function drawWall(ctx: CanvasRenderingContext2D, w: Rect): void {
  ctx.fillStyle = '#232c44'
  ctx.fillRect(w.x, w.y, w.w, w.h)

  const topGrad = ctx.createLinearGradient(0, w.y, 0, w.y + Math.min(14, w.h))
  topGrad.addColorStop(0, 'rgba(255,255,255,0.28)')
  topGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(w.x, w.y, w.w, Math.min(14, w.h))

  ctx.fillStyle = '#151c30'
  ctx.fillRect(w.x, w.y + w.h - 8, w.w, 8)

  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 3
  ctx.strokeRect(w.x + 1.5, w.y + 1.5, w.w - 3, w.h - 3)

  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(w.x + 10, w.y + 10, w.w - 20, w.h - 20)
}

export function inBush(brawler: Brawler, arena: Arena): boolean {
  for (const b of arena.bushes) {
    if (brawler.pos.x > b.x && brawler.pos.x < b.x + b.w && brawler.pos.y > b.y && brawler.pos.y < b.y + b.h) {
      return true
    }
  }
  return false
}

export function drawMeleeSwing(ctx: CanvasRenderingContext2D, b: Brawler): void {
  const def = b.def
  const arc = def.meleeArc ?? 1.9
  const reach = def.meleeRange ?? 120
  const t = 1 - b.swingT
  const eased = easeOutCubic(t)
  const startAng = b.aimAngle - arc / 2
  const ang = startAng + eased * arc
  const fade = 1 - t

  ctx.save()
  ctx.translate(b.pos.x, b.pos.y)

  ctx.globalAlpha = 0.18 * fade
  ctx.fillStyle = def.accent
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, reach, startAng, ang)
  ctx.closePath()
  ctx.fill()

  ctx.globalAlpha = fade
  ctx.strokeStyle = def.accent
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(Math.cos(startAng) * b.r * 0.4, Math.sin(startAng) * b.r * 0.4)
  ctx.lineTo(Math.cos(ang) * reach, Math.sin(ang) * reach)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(Math.cos(ang) * reach, Math.sin(ang) * reach, 5.5, 0, TAU)
  ctx.fill()

  ctx.restore()
}

export function drawBrawler(
  ctx: CanvasRenderingContext2D,
  b: Brawler,
  arena: Arena,
  opts: RenderOpts,
): void {
  const hidden = inBush(b, arena)
  const alpha = hidden ? 0.14 : 1
  ctx.globalAlpha = alpha

  ctx.save()
  ctx.translate(b.pos.x, b.pos.y)

  const base = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.15, 0, 0, b.r * 1.05)
  base.addColorStop(0, lighten(b.def.color, 55))
  base.addColorStop(0.55, b.def.color)
  base.addColorStop(1, shade(b.def.color, -35))

  ctx.beginPath()
  ctx.arc(0, 0, b.r, 0, TAU)
  ctx.fillStyle = base
  ctx.fill()

  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.stroke()

  if (b.flash > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, b.r, 0, TAU)
    ctx.fillStyle = `rgba(255,255,255,${(b.flash / 0.14) * 0.8})`
    ctx.fill()
  }

  if (b.def.melee && b.swingT > 0) {
    drawMeleeSwing(ctx, b)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.arc(-b.r * 0.45, -b.r * 0.3, 4.5, 0, TAU)
  ctx.arc(b.r * 0.2, -b.r * 0.3, 4.5, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-b.r * 0.45, -b.r * 0.3, 1.8, 0, TAU)
  ctx.arc(b.r * 0.2, -b.r * 0.3, 1.8, 0, TAU)
  ctx.fill()

  ctx.restore()

  if (b.dash.active) {
    ctx.globalAlpha = alpha * 0.5
    ctx.strokeStyle = b.def.accent
    ctx.lineWidth = 5
    ctx.setLineDash([10, 12])
    ctx.lineDashOffset = b.dash.t * 800
    const len = b.r + 90
    ctx.beginPath()
    ctx.moveTo(b.pos.x, b.pos.y)
    ctx.lineTo(b.pos.x - b.dash.dirX * len, b.pos.y - b.dash.dirY * len)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = alpha
  }

  const needsBar = opts.showHealthBars && (!hidden || b.isPlayer)
  if (needsBar && b.hp < b.maxHp) {
    const bw = b.r * 2.4
    const bh = 7
    const bx = b.pos.x - bw / 2
    const by = b.pos.y - b.r - 16
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2)
    const ratio = b.hp / b.maxHp
    ctx.fillStyle = ratio > 0.5 ? '#3fd46a' : ratio > 0.25 ? '#ffd23f' : '#ff4d4d'
    ctx.fillRect(bx, by, bw * ratio, bh)
  }

  if (b.isPlayer && !hidden && b.superReady) {
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffd86b'
    ctx.font = '900 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('★', b.pos.x, b.pos.y - b.r - 26)
  }

  ctx.globalAlpha = 1
}

export function drawAimPointer(ctx: CanvasRenderingContext2D, b: Brawler, arena: Arena): void {
  const def = b.def
  const range = def.projectileRange
  const size = def.projectileSize
  const a = b.aimAngle
  const cx = b.pos.x
  const cy = b.pos.y
  const hidden = inBush(b, arena)
  const bodyAlpha = hidden ? 0.05 : 0.16

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (def.superType) {
    case 'storm': {
      const from = b.r + 10
      const to = from + range
      const w = Math.max(3, size * 0.9)
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * to, cy + Math.sin(a) * to)
      grad.addColorStop(0, def.color)
      grad.addColorStop(1, 'rgba(255,255,255,0.5)')
      ctx.globalAlpha = bodyAlpha
      ctx.strokeStyle = grad
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * from, cy + Math.sin(a) * from)
      ctx.lineTo(cx + Math.cos(a) * to, cy + Math.sin(a) * to)
      ctx.stroke()
      break
    }
    case 'dash': {
      const from = b.r + 6
      const to = from + range
      const spread = 0.14
      ctx.globalAlpha = bodyAlpha
      ctx.fillStyle = def.color
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * from, cy + Math.sin(a) * from)
      ctx.lineTo(cx + Math.cos(a - spread) * to, cy + Math.sin(a - spread) * to)
      ctx.lineTo(cx + Math.cos(a + spread) * to, cy + Math.sin(a + spread) * to)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'boulder': {
      const radius = b.r + 10 + range
      const half = 0.2
      ctx.globalAlpha = bodyAlpha
      ctx.strokeStyle = def.color
      ctx.lineWidth = Math.max(4, size * 1.6)
      ctx.beginPath()
      ctx.arc(cx, cy, radius, a - half, a + half)
      ctx.stroke()
      break
    }
  }

  const tip = b.r + 10 + range
  ctx.globalAlpha = hidden ? 0.1 : 0.4
  ctx.fillStyle = def.accent
  ctx.beginPath()
  ctx.arc(cx + Math.cos(a) * tip, cy + Math.sin(a) * tip, Math.max(3, size * 0.9), 0, TAU)
  ctx.fill()

  ctx.restore()
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  ctx.save()
  ctx.shadowColor = p.color
  ctx.shadowBlur = 18
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.r, 0, TAU)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.r * 0.42, 0, TAU)
  ctx.fill()
  ctx.restore()
}

export function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup): void {
  const bob = Math.sin(p.pulse * 2.2) * 3
  const y = p.y + bob
  ctx.save()
  ctx.translate(p.x, y)
  ctx.shadowColor = p.kind === 'heal' ? '#3fd46a' : '#ffd23f'
  ctx.shadowBlur = 22
  if (p.kind === 'heal') {
    ctx.fillStyle = '#2bd65f'
    ctx.beginPath()
    ctx.moveTo(0, -p.r)
    ctx.lineTo(p.r, 0)
    ctx.lineTo(0, p.r)
    ctx.lineTo(-p.r, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(-5, -15, 10, 30)
    ctx.fillRect(-15, -5, 30, 10)
  } else {
    ctx.fillStyle = '#ffd23f'
    ctx.beginPath()
    ctx.moveTo(0, -p.r)
    ctx.lineTo(p.r * 0.7, -p.r * 0.7)
    ctx.lineTo(p.r, 0)
    ctx.lineTo(p.r * 0.7, p.r * 0.7)
    ctx.lineTo(0, p.r)
    ctx.lineTo(-p.r * 0.7, p.r * 0.7)
    ctx.lineTo(-p.r, 0)
    ctx.lineTo(-p.r * 0.7, -p.r * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '900 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('+', 0, 1)
  }
  ctx.restore()
}

function lighten(hex: string, amt: number): string {
  const { r, g, b } = parse(hex)
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`
}

function shade(hex: string, amt: number): string {
  const { r, g, b } = parse(hex)
  return `rgb(${Math.max(0, r + amt)},${Math.max(0, g + amt)},${Math.max(0, b + amt)})`
}

function parse(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
