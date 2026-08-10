import { Game } from './game'
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

screens.onMute = (m) => setMuted(m)
screens.onSelectCb((id) => {
  lastBrawlerId = id
  game.startMatch(id)
})
screens.onRestartCb(() => {
  game.startMatch(lastBrawlerId)
})
screens.onMenuCb(() => {
  screens.showMenu()
})
game.onEnd = (r) => {
  screens.showResults(r)
}
