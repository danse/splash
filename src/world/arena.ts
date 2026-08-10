import { mulberry32 } from '../core/math'
import { Rect, rectsOverlap } from './collision'

export interface Arena {
  width: number
  height: number
  walls: Rect[]
  bushes: Rect[]
  bounds: Rect
  spawnPoints: { x: number; y: number }[]
  powerSpots: { x: number; y: number }[]
}

const W = 2400
const H = 2400
const WALL_T = 26

export function generateArena(seed: number, numPlayers: number): Arena {
  const rng = mulberry32(seed)
  const bounds: Rect = { x: 0, y: 0, w: W, h: H }
  const wallT = WALL_T
  const walls: Rect[] = [
    { x: -wallT, y: -wallT, w: W + wallT * 2, h: wallT },
    { x: -wallT, y: H, w: W + wallT * 2, h: wallT },
    { x: -wallT, y: 0, w: wallT, h: H },
    { x: W, y: 0, w: wallT, h: H },
  ]

  const center = { x: W / 2, y: H / 2 }
  const keepClear: Rect = {
    x: center.x - 340,
    y: center.y - 340,
    w: 680,
    h: 680,
  }

  const count = 16
  for (let i = 0; i < count; i++) {
    const cellSize = 420
    const col = Math.floor(rng() * 5)
    const row = Math.floor(rng() * 5)
    const bx = 110 + col * (cellSize + 40) + rng() * 60
    const by = 110 + row * (cellSize + 40) + rng() * 60
    const w = 120 + rng() * 180
    const h = 120 + rng() * 180
    const wall: Rect = { x: bx, y: by, w, h }
    if (rectsOverlap(wall, keepClear, 90)) continue
    if (wall.x < wallT || wall.y < wallT || wall.x + wall.w > W - wallT || wall.y + wall.h > H - wallT) continue
    walls.push(wall)
  }

  const bushes: Rect[] = []
  for (let i = 0; i < 10; i++) {
    const bx = 120 + rng() * (W - 240)
    const by = 120 + rng() * (H - 240)
    const w = 120 + rng() * 130
    const h = 120 + rng() * 130
    const bush: Rect = { x: bx, y: by, w, h }
    if (rectsOverlap(bush, keepClear, 40)) continue
    bushes.push(bush)
  }

  const spawnPoints: { x: number; y: number }[] = []
  const angles = Array.from({ length: numPlayers }, (_, i) => (i / numPlayers) * Math.PI * 2)
  for (const a of angles) {
    const rad = Math.min(W, H) * 0.4
    spawnPoints.push({
      x: W / 2 + Math.cos(a) * rad,
      y: H / 2 + Math.sin(a) * rad,
    })
  }

  const powerSpots: { x: number; y: number }[] = [
    { x: center.x, y: center.y },
    { x: center.x - 240, y: center.y + 180 },
    { x: center.x + 240, y: center.y - 140 },
    { x: center.x + 60, y: center.y - 260 },
  ].map((p) => ({ x: p.x + (rng() - 0.5) * 60, y: p.y + (rng() - 0.5) * 60 }))

  return { width: W, height: H, walls, bushes, bounds, spawnPoints, powerSpots }
}
