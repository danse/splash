// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { BRAWLER_DEFS, Brawler } from './entities/brawler'
import { drawBrawler, drawAimPointer } from './render'
import { setSpriteForTest, resetSpritesForTest } from './render/sprites'
import type { Arena } from './world/arena'

afterEach(() => {
  resetSpritesForTest()
})

const emptyArena = { bushes: [] } as unknown as Arena

function makeRecorder(): {
  ctx: CanvasRenderingContext2D
  translateCalls: Array<[number, number]>
  arcs: Array<[number, number, number, number, number]>
  rotates: number[]
  drawImages: Array<{ img: unknown; dx: number; dy: number; dw: number; dh: number }>
} {
  const translateCalls: Array<[number, number]> = []
  const arcs: Array<[number, number, number, number, number]> = []
  const rotates: number[] = []
  const drawImages: Array<{ img: unknown; dx: number; dy: number; dw: number; dh: number }> = []
  const target = {
    arc: (x: number, y: number, r: number, s: number, e: number) => {
      arcs.push([x, y, r, s, e])
    },
    translate: (x: number, y: number) => {
      translateCalls.push([x, y])
    },
    rotate: (a: number) => {
      rotates.push(a)
    },
    drawImage: (img: unknown, dx: number, dy: number, dw: number, dh: number) => {
      drawImages.push({ img, dx, dy, dw, dh })
    },
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  }
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return (t as Record<string | symbol, unknown>)[prop]
      return () => {}
    },
    set() {
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, translateCalls, arcs, rotates, drawImages }
}

const eps = 1e-6
const approx = (a: number, b: number) => Math.abs(a - b) < eps
const expectNear = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(eps)

const TANK_RANGE = 135
const TANK_ARC = 1.9

describe('melee rendering geometry', () => {
  beforeEach(() => {
    setSpriteForTest('tank', 75, 70)
    setSpriteForTest('tank-barrel', 16, 50)
    setSpriteForTest('blaster', 36, 43)
    setSpriteForTest('charger', 33, 43)
  })

  it('draws the swing at the brawler pivot, not offset', () => {
    const { ctx, translateCalls } = makeRecorder()
    const tank = new Brawler(BRAWLER_DEFS.tank, 400, 300)
    tank.aimAngle = Math.PI / 3
    tank.swingT = 0.5

    drawBrawler(ctx, tank, emptyArena, { showHealthBars: false })

    const atPivot = translateCalls.filter(([x, y]) => x === 400 && y === 300)
    expect(atPivot).toHaveLength(1)
  })

  it('swings symmetrically around the aim direction', () => {
    const { ctx, arcs } = makeRecorder()
    const tank = new Brawler(BRAWLER_DEFS.tank, 400, 300)
    tank.aimAngle = Math.PI / 3
    tank.swingT = 0.5

    drawBrawler(ctx, tank, emptyArena, { showHealthBars: false })

    const swingSlice = arcs.filter(([, , r]) => approx(r, TANK_RANGE))
    expect(swingSlice.length).toBeGreaterThan(0)
    const start = swingSlice[0][3]
    expectNear(start, Math.PI / 3 - TANK_ARC / 2)
    expect(start + TANK_ARC).toBeGreaterThan(Math.PI / 3)
  })

  it('shows the aim pointer at melee reach for a melee brawler', () => {
    const { ctx, arcs } = makeRecorder()
    const tank = new Brawler(BRAWLER_DEFS.tank, 400, 300)
    tank.aimAngle = Math.PI / 3

    drawAimPointer(ctx, tank, emptyArena)

    const pointerArc = arcs.find(([, , , s, e]) => approx((s + e) / 2, Math.PI / 3) && e - s < Math.PI)
    expect(pointerArc).toBeDefined()
    expectNear(pointerArc![2], TANK_RANGE)

    const tip = arcs.find(([x, y]) => approx(Math.hypot(x - 400, y - 300), TANK_RANGE))
    expect(tip).toBeDefined()
  })

  it('keeps the ranged aim pointer unchanged', () => {
    const { ctx, arcs } = makeRecorder()
    const blaster = new Brawler(BRAWLER_DEFS.blaster, 100, 100)
    blaster.aimAngle = 0

    drawAimPointer(ctx, blaster, emptyArena)

    const expectedTip = blaster.r + 10 + 600
    const tip = arcs.find(([x, y]) => approx(Math.hypot(x - 100, y - 100), expectedTip))
    expect(tip).toBeDefined()
  })

  it('draws the tank super aim as an arc at the boulder range', () => {
    const { ctx, arcs } = makeRecorder()
    const tank = new Brawler(BRAWLER_DEFS.tank, 400, 300)
    tank.aimAngle = Math.PI / 3

    drawAimPointer(ctx, tank, emptyArena, 'super')

    const pointerArc = arcs.find(([, , , s, e]) => approx((s + e) / 2, Math.PI / 3) && e - s < Math.PI)
    expect(pointerArc).toBeDefined()
    expectNear(pointerArc![2], BRAWLER_DEFS.tank.superRange)

    const tip = arcs.find(([x, y]) => approx(Math.hypot(x - 400, y - 300), BRAWLER_DEFS.tank.superRange))
    expect(tip).toBeDefined()
  })

  it('draws the blaster super aim beam out to the storm range', () => {
    const { ctx, arcs } = makeRecorder()
    const blaster = new Brawler(BRAWLER_DEFS.blaster, 100, 100)
    blaster.aimAngle = 0

    drawAimPointer(ctx, blaster, emptyArena, 'super')

    const expectedTip = blaster.r + 10 + BRAWLER_DEFS.blaster.superRange
    const tip = arcs.find(([x, y]) => approx(Math.hypot(x - 100, y - 100), expectedTip))
    expect(tip).toBeDefined()
  })

  it('draws the charger super aim wedge out to the dash distance', () => {
    const { ctx, arcs } = makeRecorder()
    const charger = new Brawler(BRAWLER_DEFS.charger, 100, 100)
    charger.aimAngle = 0

    drawAimPointer(ctx, charger, emptyArena, 'super')

    const expectedTip = charger.r + 10 + BRAWLER_DEFS.charger.superRange
    const tip = arcs.find(([x, y]) => approx(Math.hypot(x - 100, y - 100), expectedTip))
    expect(tip).toBeDefined()
  })

  it('honors the angle override when the super joystick is dragged', () => {
    const { ctx, arcs } = makeRecorder()
    const blaster = new Brawler(BRAWLER_DEFS.blaster, 100, 100)
    blaster.aimAngle = 0

    drawAimPointer(ctx, blaster, emptyArena, 'super', Math.PI / 2)

    const expectedTip = blaster.r + 10 + BRAWLER_DEFS.blaster.superRange
    const tip = arcs.find(([x, y]) => approx(Math.hypot(x - 100, y - 100), expectedTip))
    expect(tip).toBeDefined()
    expectNear(tip![0], 100)
  })
})

describe('sprite rendering', () => {
  it('rotates a ranged brawler sprite toward the facing direction', () => {
    setSpriteForTest('blaster', 36, 43)
    const { ctx, rotates, drawImages } = makeRecorder()
    const blaster = new Brawler(BRAWLER_DEFS.blaster, 200, 200)
    blaster.facing = Math.PI / 3

    drawBrawler(ctx, blaster, emptyArena, { showHealthBars: false })

    const body = drawImages.find((d) => d.dw === BRAWLER_DEFS.blaster.spriteScale)
    expect(body).toBeDefined()
    expect(rotates.some((r) => approx(r, Math.PI / 3))).toBe(true)
  })

  it('rotates tank body to facing and barrel to aim angle independently', () => {
    setSpriteForTest('tank', 75, 70)
    setSpriteForTest('tank-barrel', 16, 50)
    const { ctx, rotates, drawImages } = makeRecorder()
    const tank = new Brawler(BRAWLER_DEFS.tank, 400, 300)
    tank.facing = Math.PI / 4
    tank.aimAngle = 0

    drawBrawler(ctx, tank, emptyArena, { showHealthBars: false })

    const body = drawImages.find((d) => d.dw === BRAWLER_DEFS.tank.spriteScale)
    expect(body).toBeDefined()
    expect(rotates.some((r) => approx(r, Math.PI / 4 + Math.PI / 2))).toBe(true)
    expect(rotates.some((r) => approx(r, 0 + Math.PI / 2))).toBe(true)
  })

  it('uses the gun sprite during the firing window', () => {
    setSpriteForTest('blaster', 36, 43)
    setSpriteForTest('blaster-fire', 52, 43)
    const { ctx, drawImages } = makeRecorder()
    const blaster = new Brawler(BRAWLER_DEFS.blaster, 200, 200)
    blaster.facing = 0
    blaster.fireFacingTimer = 0.1

    drawBrawler(ctx, blaster, emptyArena, { showHealthBars: false })

    // gun sprite is 52 wide, scaled to spriteScale=52 → dh=52*43/52=43
    // stand sprite is 36 wide, scaled to spriteScale=52 → dh=52*43/36≈62
    const gunDraw = drawImages.find((d) => d.dw === BRAWLER_DEFS.blaster.spriteScale)
    expect(gunDraw).toBeDefined()
    expect(gunDraw!.dh).toBeCloseTo(43, 0)
  })

  it('draws the melee swing on top of a tank sprite', () => {
    setSpriteForTest('tank', 75, 70)
    setSpriteForTest('tank-barrel', 16, 50)
    const { ctx, drawImages } = makeRecorder()
    const tank = new Brawler(BRAWLER_DEFS.tank, 400, 300)
    tank.aimAngle = Math.PI / 3
    tank.swingT = 0.5

    drawBrawler(ctx, tank, emptyArena, { showHealthBars: false })

    const body = drawImages.find((d) => d.dw === BRAWLER_DEFS.tank.spriteScale)
    expect(body).toBeDefined()
    const barrel = drawImages.find((d) => d.dw !== BRAWLER_DEFS.tank.spriteScale)
    expect(barrel).toBeDefined()
  })
})
