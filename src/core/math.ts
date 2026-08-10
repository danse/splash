export const TAU = Math.PI * 2

export interface Vec2 {
  x: number
  y: number
}

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y })

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by))
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax)
}

export function angleLerp(a: number, b: number, t: number): number {
  let diff = (b - a) % TAU
  if (diff > Math.PI) diff -= TAU
  if (diff < -Math.PI) diff += TAU
  return a + diff * t
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
