// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { Game } from './game'
import { generateArena } from './world/arena'

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

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => stubCtx()) as never)
  document.body.innerHTML = '<div id="app"><canvas id="game-canvas"></canvas></div>'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('wall crossing', () => {
  it('does not cross internal walls at regular speed', () => {
    const game = new Game()
    ;(game as unknown as { loop: { stop(): void } }).loop.stop()
    game.startMatch('tank', 'practice')
    ;(game as unknown as { arena: unknown }).arena = generateArena(0, 6)
    const player = game.player
    for (const b of game.bots) b.alive = false
    const g = game as unknown as { moveBrawlers(): void }
    const arena = game.arena
    const walls = (arena.walls as Array<{ x: number; y: number; w: number; h: number }>).filter(
      (w) => w.y > 0 && w.y + w.h < arena.height,
    )
    for (const wall of walls) {
      player.pos.x = wall.x + wall.w / 2
      player.pos.y = wall.y - player.r - 0.001
      for (let i = 0; i < 300; i++) {
        player.pos.y += 3.83
        g.moveBrawlers()
        expect(
          player.pos.y,
          `wall [${wall.x.toFixed(0)}, ${wall.y.toFixed(0)}, ${wall.w.toFixed(0)}, ${wall.h.toFixed(0)}] crossed at i=${i}`,
        ).toBeLessThanOrEqual(wall.y + wall.h + player.r + 0.001)
      }
    }
  })
})
