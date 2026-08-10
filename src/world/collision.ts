export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Circle {
  x: number
  y: number
  r: number
}

export function circleRectCollide(c: Circle, r: Rect): boolean {
  const cx = Math.max(r.x, Math.min(c.x, r.x + r.w))
  const cy = Math.max(r.y, Math.min(c.y, r.y + r.h))
  const dx = c.x - cx
  const dy = c.y - cy
  return dx * dx + dy * dy < c.r * c.r
}

export function pushOutOfRect(c: Circle, r: Rect): void {
  const cx = Math.max(r.x, Math.min(c.x, r.x + r.w))
  const cy = Math.max(r.y, Math.min(c.y, r.y + r.h))
  let dx = c.x - cx
  let dy = c.y - cy
  const d2 = dx * dx + dy * dy
  if (d2 >= c.r * c.r) return
  if (d2 === 0) {
    const left = c.x - r.x
    const right = r.x + r.w - c.x
    const top = c.y - r.y
    const bottom = r.y + r.h - c.y
    const m = Math.min(left, right, top, bottom)
    if (m === left) c.x = r.x - c.r
    else if (m === right) c.x = r.x + r.w + c.r
    else if (m === top) c.y = r.y - c.r
    else c.y = r.y + r.h + c.r
    return
  }
  const d = Math.sqrt(d2)
  const push = (c.r - d) / d
  c.x += dx * push
  c.y += dy * push
}

export function resolveCircle(rects: Rect[], c: Circle, iterations = 4): void {
  for (let i = 0; i < iterations; i++) {
    let collided = false
    for (const r of rects) {
      if (circleRectCollide(c, r)) {
        pushOutOfRect(c, r)
        collided = true
      }
    }
    if (!collided) break
  }
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x - pad < b.x + b.w + pad &&
    a.x + a.w + pad > b.x - pad &&
    a.y - pad < b.y + b.h + pad &&
    a.y + a.h + pad > b.y - pad
  )
}

export function circleInRect(c: Circle, r: Rect): boolean {
  return c.x > r.x && c.x < r.x + r.w && c.y > r.y && c.y < r.y + r.h
}
