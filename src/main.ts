import { Game, type ModeId } from './game'
import { Screens } from './ui/screens'
import { setMuted } from './audio'
import { initDeviceGate, isTouchDevice, lockLandscape, requestFullscreen, toggleFullscreen } from './device'
import { DEFAULT_DIFFICULTY, type DifficultyId } from './entities/difficulty'

const app = document.getElementById('app')!

initDeviceGate()

if (isTouchDevice()) {
  const canvas = document.createElement('canvas')
  canvas.id = 'game-canvas'
  app.appendChild(canvas)

  const vignette = document.createElement('div')
  vignette.id = 'vignette'
  app.appendChild(vignette)

  const game = new Game()
  const screens = new Screens()

  window.addEventListener('pointerdown', () => {
    lockLandscape()
    void requestFullscreen()
  }, { once: true })

  screens.onFullscreen = () => {
    void toggleFullscreen()
  }

  let lastBrawlerId = 'blaster'
  let lastMode: ModeId = 'brawl'
  let lastDifficulty: DifficultyId = DEFAULT_DIFFICULTY

  screens.onMute = (m) => setMuted(m)
  screens.onSelectCb((id, difficulty) => {
    lastBrawlerId = id
    lastMode = 'brawl'
    lastDifficulty = difficulty
    game.start()
    game.startMatch(id, 'brawl', difficulty)
  })
  screens.onPracticeCb((id) => {
    lastBrawlerId = id
    lastMode = 'practice'
    game.start()
    game.startMatch(id, 'practice')
  })
  screens.onRestartCb(() => {
    game.start()
    game.startMatch(lastBrawlerId, lastMode, lastDifficulty)
  })
  screens.onMenuCb(() => {
    screens.showMenu()
  })
  game.onEnd = (r) => {
    screens.showResults(r)
  }
  game.onExit = () => {
    screens.showMenu()
  }
}
