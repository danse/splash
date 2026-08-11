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

function makePointerEvent(type: string, props: Record<string, unknown>): Event {
  const e = new Event(type, { bubbles: true }) as unknown as Record<string, unknown>
  Object.assign(e, {
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    pointerType: 'touch',
    button: 0,
    ...props,
  })
  return e as unknown as PointerEvent
}

function touchDown(x: number, y: number, id = 1): void {
  window.dispatchEvent(makePointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: id, pointerType: 'touch' }))
}

function touchMove(x: number, y: number, id = 1): void {
  window.dispatchEvent(makePointerEvent('pointermove', { clientX: x, clientY: y, pointerId: id, pointerType: 'touch' }))
}

function touchUp(id = 1): void {
  window.dispatchEvent(makePointerEvent('pointerup', { pointerId: id, pointerType: 'touch' }))
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

describe('Practice mode', () => {
  it('never ends the match and respawns the player', () => {
    const { game, update } = makeGame()
    game.startMatch('blaster', 'practice')
    const results: MatchResult[] = []
    game.onEnd = (r) => results.push(r)
    game.player.alive = false
    for (let i = 0; i < 400; i++) update(1 / 60)
    expect(results.length).toBe(0)
    expect(game.player.alive).toBe(true)
  })

  it('gives only the first bot a brain (the attacker)', () => {
    const { game } = makeGame()
    game.startMatch('blaster', 'practice')
    const brains = (game as unknown as { brains: Map<unknown, unknown> }).brains
    expect(brains.get(game.bots[0])).toBeDefined()
    expect(brains.get(game.bots[1])).toBeUndefined()
    expect(brains.get(game.bots[4])).toBeUndefined()
  })

  it('respawns bots that die in practice', () => {
    const { game, update } = makeGame()
    game.startMatch('blaster', 'practice')
    for (const bot of game.bots) bot.alive = false
    for (let i = 0; i < 400; i++) update(1 / 60)
    expect(game.bots.every((b) => b.alive)).toBe(true)
  })

  it('the attacker bot stays still but fires at the player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { game, update } = makeGame()
    game.startMatch('blaster', 'practice')
    const attacker = game.bots[0]
    const cx = game.arena.width / 2
    const cy = game.arena.height / 2
    game.player.pos.x = cx
    game.player.pos.y = cy
    attacker.pos.x = cx + 150
    attacker.pos.y = cy
    let fired = false
    for (let i = 0; i < 60; i++) update(1 / 60)
    const sx = attacker.pos.x
    const sy = attacker.pos.y
    for (let i = 0; i < 300; i++) {
      update(1 / 60)
      if ((game as unknown as { projectiles: unknown[] }).projectiles.length > 0) fired = true
    }
    expect(Math.hypot(attacker.pos.x - sx, attacker.pos.y - sy)).toBeLessThan(5)
    expect(fired).toBe(true)
  })

  it('exiting practice stops the game loop', () => {
    const { game } = makeGame()
    game.startMatch('blaster', 'practice')
    const loop = (game as unknown as { loop: { start(): void; running: boolean } }).loop
    loop.start()
    let exited = false
    game.onExit = () => {
      exited = true
    }
    const exitBtn = document.getElementById('btn-exit') as HTMLElement
    exitBtn.click()
    expect(exited).toBe(true)
    expect(loop.running).toBe(false)
  })

  it('keeps the player inside the arena after a dash knockback at the top wall', () => {
    const { game, update } = makeGame()
    game.startMatch('blaster', 'practice')
    ;(game as unknown as { phase: string }).phase = 'playing'
    const player = game.player
    player.pos.x = 1200
    player.pos.y = player.r
    const attacker = game.bots[0]
    attacker.pos.x = 1200
    attacker.pos.y = player.r + attacker.r + 5
    attacker.def.superType = 'dash'
    attacker.dash = {
      active: true,
      dirX: 0,
      dirY: 1,
      speed: 1300,
      t: 0.34,
      duration: 0.34,
      hitIds: new Set(),
    }
    for (let i = 0; i < 60; i++) update(1 / 60)
    expect(player.pos.y).toBeGreaterThanOrEqual(player.r - 0.5)
    expect(player.pos.y).toBeLessThanOrEqual(game.arena.height - player.r + 0.5)
  })
})

function screenYOf(game: Game): number {
  const cam = (game as unknown as { camera: Camera }).camera
  return (game.player.pos.y - cam.y) * cam.scale + cam.viewH / 2
}

function startPlaying(): { game: Game; update: (dt: number) => void } {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const { game, update } = makeGame()
  game.startMatch('blaster', 'practice')
  setViewport(844, 390, 2)
  for (let i = 0; i < 300; i++) update(1 / 60)
  return { game, update }
}

describe('Player stays on camera', () => {
  it('stays fully visible while walking to the bottom of the world', () => {
    const { game, update } = startPlaying()
    touchDown(200, 195, 1)
    touchMove(200, 257, 1)
    const cam = (game as unknown as { camera: Camera }).camera
    for (let i = 0; i < 600; i++) {
      update(1 / 60)
      const sy = screenYOf(game)
      expect(sy, `bottom walk frame ${i} playerY=${game.player.pos.y.toFixed(1)}`).toBeGreaterThanOrEqual(0)
      expect(sy, `bottom walk frame ${i}`).toBeLessThanOrEqual(cam.viewH)
    }
  })

  it('stays fully visible while walking to the top of the world', () => {
    const { game, update } = startPlaying()
    touchDown(200, 195, 1)
    touchMove(200, 133, 1)
    const cam = (game as unknown as { camera: Camera }).camera
    for (let i = 0; i < 600; i++) {
      update(1 / 60)
      const sy = screenYOf(game)
      expect(sy, `top walk frame ${i} playerY=${game.player.pos.y.toFixed(1)}`).toBeGreaterThanOrEqual(0)
      expect(sy, `top walk frame ${i}`).toBeLessThanOrEqual(cam.viewH)
    }
  })

  it('stays fully visible when the player respawns far from the camera', () => {
    const { game, update } = startPlaying()
    const cam = (game as unknown as { camera: Camera }).camera
    const player = game.player
    player.pos.x = 1200
    player.pos.y = 40
    for (let i = 0; i < 60; i++) update(1 / 60)
    expect(cam.y).toBeLessThan(600)
    player.alive = false
    for (let i = 0; i < 400; i++) {
      update(1 / 60)
      const sy = screenYOf(game)
      expect(sy, `after respawn frame ${i} playerY=${player.pos.y.toFixed(1)} camY=${cam.y.toFixed(1)}`).toBeGreaterThanOrEqual(0)
      expect(sy, `after respawn frame ${i}`).toBeLessThanOrEqual(cam.viewH)
    }
  })
})

describe('Player aims and fires on release', () => {
  it('aims while held and fires exactly once on release', () => {
    const { game, update } = makeGame()
    game.startMatch('blaster', 'practice')
    for (let i = 0; i < 210; i++) update(1 / 60)
    const player = game.player

    touchDown(800, 500, 2)
    touchMove(850, 560, 2)
    update(1 / 60)
    expect(player.aiming).toBe(true)
    expect(player.fireCd).toBe(0)

    for (let i = 0; i < 10; i++) update(1 / 60)
    expect(player.aiming).toBe(true)
    expect(player.fireCd).toBe(0)

    touchUp(2)
    update(1 / 60)
    expect(player.aiming).toBe(false)
    expect(player.fireCd).toBeCloseTo(1 / 2.6, 5)
  })

  it('does not fire when the stick is released during the countdown', () => {
    const { game, update } = makeGame()
    game.startMatch('blaster', 'practice')
    const projectiles = (game as unknown as { projectiles: unknown[] }).projectiles

    touchDown(800, 500, 2)
    touchMove(850, 560, 2)
    update(1 / 60)
    touchUp(2)
    update(1 / 60)
    expect(projectiles.length).toBe(0)
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
