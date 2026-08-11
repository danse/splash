import { BRAWLER_DEFS, BrawlerDef } from '../entities/brawler'

export interface MatchResult {
  won: boolean
  kills: number
  botsLeft: number
  time: number
  brawlerName: string
}

export class Screens {
  private menu: HTMLElement
  private select: HTMLElement
  private results: HTMLElement
  private resultsTitle: HTMLElement
  private resultsStats: HTMLElement
  private onSelect!: (id: string) => void
  private onPractice!: (id: string) => void
  private onRestart!: () => void
  private onMenu!: () => void
  private mutedBtn: HTMLElement
  private muted = false
  selected: string = 'blaster'

  constructor() {
    const app = document.getElementById('app')!

    this.menu = document.createElement('div')
    this.menu.className = 'screen'
    this.menu.innerHTML = `
      <h1>SPLASH</h1>
      <p class="tagline">Twin-stick arena brawl. Move with your left thumb, aim &amp; fire with your right.</p>
      <div class="row">
        <button class="btn" id="btn-play">▶ Play</button>
        <button class="btn ghost" id="btn-mute">🔊</button>
      </div>
    `
    app.appendChild(this.menu)

    this.select = document.createElement('div')
    this.select.className = 'screen hidden'
    this.select.innerHTML = `
      <h1 style="font-size:clamp(30px,8vw,48px)">Pick your brawler</h1>
      <div class="brawler-grid" id="brawler-grid"></div>
      <div class="row">
        <button class="btn" id="btn-fight">⚔ Brawl</button>
        <button class="btn ghost" id="btn-practice">🎯 Practice</button>
        <button class="btn ghost" id="btn-back">← Back</button>
      </div>
    `
    app.appendChild(this.select)

    const grid = this.select.querySelector('#brawler-grid')!
    for (const def of Object.values(BRAWLER_DEFS)) {
      const card = document.createElement('div')
      card.className = 'brawler-card'
      card.dataset.id = def.id
      card.innerHTML = `
        <div class="brawler-icon" style="background:${def.color}">
          <span class="glyph">${def.glyph}</span>
        </div>
        <div class="name">${def.name}</div>
        <div class="desc">${statLine(def)}</div>
      `
      grid.appendChild(card)
    }

    this.results = document.createElement('div')
    this.results.className = 'screen hidden'
    this.results.innerHTML = `
      <h1 id="results-title" style="font-size:clamp(34px,10vw,64px)">VICTORY</h1>
      <p class="tagline" id="results-stats"></p>
      <div class="row">
        <button class="btn" id="btn-again">↻ Play again</button>
        <button class="btn ghost" id="btn-home">Menu</button>
      </div>
    `
    app.appendChild(this.results)
    this.resultsTitle = this.results.querySelector('#results-title') as HTMLElement
    this.resultsStats = this.results.querySelector('#results-stats') as HTMLElement

    this.mutedBtn = this.menu.querySelector('#btn-mute') as HTMLElement
    this.select.querySelectorAll('.brawler-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.selected = (card as HTMLElement).dataset.id!
        this.select.querySelectorAll('.brawler-card').forEach((c) => c.classList.remove('selected'))
        card.classList.add('selected')
      })
    })
    ;(this.select.querySelector('.brawler-card') as HTMLElement).classList.add('selected')

    this.menu.querySelector('#btn-play')!.addEventListener('click', () => {
      this.menu.classList.add('hidden')
      this.select.classList.remove('hidden')
    })
    this.mutedBtn.addEventListener('click', () => {
      this.muted = !this.muted
      this.mutedBtn.textContent = this.muted ? '🔇' : '🔊'
      this.onMute(this.muted)
    })
    this.select.querySelector('#btn-fight')!.addEventListener('click', () => {
      this.hideAll()
      this.onSelect(this.selected)
    })
    this.select.querySelector('#btn-practice')!.addEventListener('click', () => {
      this.hideAll()
      this.onPractice(this.selected)
    })
    this.select.querySelector('#btn-back')!.addEventListener('click', () => {
      this.select.classList.add('hidden')
      this.menu.classList.remove('hidden')
    })
    this.results.querySelector('#btn-again')!.addEventListener('click', () => {
      this.hideAll()
      this.onRestart()
    })
    this.results.querySelector('#btn-home')!.addEventListener('click', () => {
      this.onMenu()
    })
  }

  onSelectCb = (fn: (id: string) => void): void => {
    this.onSelect = fn
  }
  onPracticeCb = (fn: (id: string) => void): void => {
    this.onPractice = fn
  }
  onRestartCb = (fn: () => void): void => {
    this.onRestart = fn
  }
  onMenuCb = (fn: () => void): void => {
    this.onMenu = fn
  }
  onMute = (_muted: boolean): void => {}

  hideAll(): void {
    this.menu.classList.add('hidden')
    this.select.classList.add('hidden')
    this.results.classList.add('hidden')
  }

  showMenu(): void {
    this.results.classList.add('hidden')
    this.select.classList.add('hidden')
    this.menu.classList.remove('hidden')
  }

  showSelect(): void {
    this.menu.classList.add('hidden')
    this.select.classList.remove('hidden')
  }

  showResults(r: MatchResult): void {
    this.results.classList.remove('hidden')
    this.resultsTitle.textContent = r.won ? 'VICTORY!' : 'DEFEAT'
    this.resultsTitle.style.background = r.won
      ? 'linear-gradient(180deg,#a9ffd0 0%,#3fd46a 60%,#1c9c48 100%)'
      : 'linear-gradient(180deg,#ff9d8a 0%,#ff4d4d 60%,#a81c1c 100%)'
    this.resultsTitle.style.webkitBackgroundClip = 'text'
    this.resultsTitle.style.backgroundClip = 'text'
    const mins = Math.floor(r.time / 60)
    const secs = Math.floor(r.time % 60)
    this.resultsStats.innerHTML = `
      ${r.brawlerName} · <b>${r.kills}</b> kills · <b>${r.botsLeft}</b> bots left · ${mins}:${secs.toString().padStart(2, '0')}
    `
  }
}

function statLine(def: BrawlerDef): string {
  if (def.superType === 'dash') return 'Fast · Short range · Dash super'
  if (def.superType === 'boulder') return 'Tanky · Close-combat swings · Boulder super'
  return 'Balanced · Long range · Storm super'
}
