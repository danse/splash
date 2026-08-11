import { Game, type ModeId } from './game'
import { Screens } from './ui/screens'
import { setMuted } from './audio'
import { initDeviceGate, isTouchDevice, lockLandscape, requestFullscreen, toggleFullscreen } from './device'

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

  screens.onMute = (m) => setMuted(m)
  screens.onSelectCb((id) => {
    lastBrawlerId = id
    lastMode = 'brawl'
    game.start()
    game.startMatch(id, 'brawl')
  })
  screens.onPracticeCb((id) => {
    lastBrawlerId = id
    lastMode = 'practice'
    game.start()
    game.startMatch(id, 'practice')
  })
  screens.onRestartCb(() => {
    game.start()
    game.startMatch(lastBrawlerId, lastMode)
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
