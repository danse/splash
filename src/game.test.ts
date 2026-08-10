// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { Game, MatchResult } from './game'
import { Camera } from './core/camera'

function stubCtx(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {}
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} })
      }
      return () => {}
    },
    set() {
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function makeGame(): { game: Game; update: (dt: number) => void } {
  const game = new Game()
  ;(game as unknown as { loop: { stop(): void } }).loop.stop()
  const update = (game as unknown as { update(dt: number): void }).update.bind(game)
  return { game, update }
}

function runMatch(game: Game, update: (dt: number) => void, kill: (g: Game) => void): { calls: number; results: MatchResult[] } {
  game.startMatch('blaster')
  kill(game)
  const results: MatchResult[] = []
  game.onEnd = (r) => results.push(r)
  const tick = 1 / 60
  for (let i = 0; i < 600; i++) update(tick)
  return { calls: results.length, results }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => stubCtx()) as never)
  document.body.innerHTML = '<div id="app"><canvas id="game-canvas"></canvas></div>'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Game match end', () => {
  it('fires onEnd exactly once after the player dies', () => {
    const { game, update } = makeGame()
    const { calls, results } = runMatch(game, update, (g) => {
      g.player.alive = false
    })
    expect(calls).toBe(1)
    expect(results[0].won).toBe(false)
    expect(results[0].brawlerName).toBe('Blaster')
    expect(results[0].botsLeft).toBe(5)
    expect(results[0].kills).toBe(0)
  })

  it('fires onEnd exactly once when all bots are dead (win)', () => {
    const { game, update } = makeGame()
    const { calls, results } = runMatch(game, update, (g) => {
      for (const bot of g.bots) bot.alive = false
    })
    expect(calls).toBe(1)
    expect(results[0].won).toBe(true)
    expect(results[0].botsLeft).toBe(0)
  })

  it('does not fire onEnd before the match has ended', () => {
    const { game, update } = makeGame()
    game.startMatch('blaster')
    const results: MatchResult[] = []
    game.onEnd = (r) => results.push(r)
    for (let i = 0; i < 100; i++) update(1 / 60)
    expect(results.length).toBe(0)
  })
})

function setViewport(w: number, h: number, dpr = 1): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('Game resize handling', () => {
  it('ignores resize events that repeat the same dimensions', () => {
    const { game } = makeGame()
    const cam = (game as unknown as { camera: Camera }).camera
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    setViewport(1024, 768)
    const w0 = canvas.width
    const scale0 = cam.scale
    setViewport(1024, 768)
    expect(canvas.width).toBe(w0)
    expect(cam.scale).toBe(scale0)
  })

  it('keeps the camera scale on a height-only resize but still resizes the canvas', () => {
    const { game } = makeGame()
    const cam = (game as unknown as { camera: Camera }).camera
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    setViewport(1024, 768)
    setViewport(1024, 900)
    expect(canvas.height).toBe(900)
    expect(cam.scale).toBeCloseTo(0.768, 5)
  })

  it('rescales the camera when the width changes', () => {
    const { game } = makeGame()
    const cam = (game as unknown as { camera: Camera }).camera
    setViewport(1024, 768)
    setViewport(1200, 900)
    expect(cam.scale).toBeCloseTo(0.9, 5)
  })
})
