import { describe, expect, it, beforeEach } from 'vitest'
import { Brawler, BRAWLER_DEFS } from './brawler'
import { BotBrain } from './bot'
import { Rect } from '../world/collision'

let bot: Brawler
let brain: BotBrain

beforeEach(() => {
  bot = new Brawler(BRAWLER_DEFS.charger, 100, 100)
  brain = new BotBrain(100, 100)
})

const targetEast = (dist: number): Brawler =>
  new Brawler(BRAWLER_DEFS.blaster, bot.pos.x + dist, bot.pos.y)

const all = (...bs: Brawler[]): Brawler[] => [bot, ...bs]
const walls = (): Rect[] => []

describe('BotBrain', () => {
  it('fires when an enemy is within range and cooldown is ready', () => {
    bot.fireCd = 0
    const ctrl = brain.think(bot, all(targetEast(150)), walls(), 1 / 60, 0)
    expect(ctrl.firing).toBe(true)
  })

  it('does not fire when out of range', () => {
    const ctrl = brain.think(bot, all(targetEast(2000)), walls(), 1 / 60, 0)
    expect(ctrl.firing).toBe(false)
  })

  it('moves toward a distant enemy', () => {
    const ctrl = brain.think(bot, all(targetEast(1000)), walls(), 1 / 60, 0)
    expect(ctrl.moveX).toBeGreaterThan(0.5)
  })

  it('retreats when low on health', () => {
    bot.hp = bot.maxHp * 0.2
    const ctrl = brain.think(bot, all(targetEast(600)), walls(), 1 / 60, 0)
    expect(ctrl.moveX).toBeLessThan(-0.2)
  })

  it('queues a dash super when close to an enemy', () => {
    bot.superCharge = 1
    bot.superCd = 0
    const ctrl = brain.think(bot, all(targetEast(200)), walls(), 1 / 60, 0)
    expect(ctrl.superQueued).toBe(true)
  })

  it('does not queue a super when far away', () => {
    bot.superCharge = 1
    bot.superCd = 0
    const ctrl = brain.think(bot, all(targetEast(1500)), walls(), 1 / 60, 0)
    expect(ctrl.superQueued).toBe(false)
  })

  it('steers away from a wall blocking its path', () => {
    bot = new Brawler(BRAWLER_DEFS.charger, 100, 100)
    brain = new BotBrain(100, 100)
    const wallAhead: Rect[] = [{ x: 130, y: 0, w: 200, h: 400 }]
    const enemy = new Brawler(BRAWLER_DEFS.blaster, 2000, 100)
    const ctrl = brain.think(bot, all(enemy), wallAhead, 1 / 60, 0)
    expect(ctrl.moveX).toBeLessThan(0.5)
  })

  it('returns a normalized movement vector', () => {
    const ctrl = brain.think(bot, all(targetEast(1000)), walls(), 1 / 60, 0)
    const len = Math.hypot(ctrl.moveX, ctrl.moveY)
    expect(len).toBeLessThanOrEqual(1.01)
  })

  it('wanders toward a fresh target when alone', () => {
    const ctrl = brain.think(bot, [], walls(), 1 / 60, 0)
    expect(ctrl.firing).toBe(false)
    expect(brain.wanderTarget.x).toBeGreaterThanOrEqual(140)
    expect(brain.wanderTarget.x).toBeLessThanOrEqual(2260)
    expect(brain.wanderTarget.y).toBeGreaterThanOrEqual(140)
    expect(brain.wanderTarget.y).toBeLessThanOrEqual(2260)
    expect(Math.hypot(ctrl.moveX, ctrl.moveY)).toBeCloseTo(1, 3)
  })

  it('aims at the nearest enemy (within wobble inaccuracy)', () => {
    const near = new Brawler(BRAWLER_DEFS.tank, bot.pos.x + 200, bot.pos.y)
    const far = new Brawler(BRAWLER_DEFS.blaster, bot.pos.x + 2000, bot.pos.y + 2000)
    const ctrl = brain.think(bot, [near, far], walls(), 1 / 60, 0)
    expect(ctrl.aimAngle).toBeGreaterThanOrEqual(-0.1)
    expect(ctrl.aimAngle).toBeLessThanOrEqual(0.1)
  })
})
