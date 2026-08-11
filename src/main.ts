import { Game, type ModeId } from './game'
import { Screens } from './ui/screens'
import { setMuted } from './audio'

const app = document.getElementById('app')!

const canvas = document.createElement('canvas')
canvas.id = 'game-canvas'
app.appendChild(canvas)

const vignette = document.createElement('div')
vignette.id = 'vignette'
app.appendChild(vignette)

const game = new Game()
const screens = new Screens()

let lastBrawlerId = 'blaster'
let lastMode: ModeId = 'brawl'

screens.onMute = (m) => setMuted(m)
screens.onSelectCb((id) => {
  lastBrawlerId = id
  lastMode = 'brawl'
  game.startMatch(id, 'brawl')
})
screens.onPracticeCb((id) => {
  lastBrawlerId = id
  lastMode = 'practice'
  game.startMatch(id, 'practice')
})
screens.onRestartCb(() => {
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
