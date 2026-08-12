import { BRAWLER_DEFS, BrawlerDef } from '../entities/brawler'
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type DifficultyId } from '../entities/difficulty'
import { APP_VERSION } from '../version'

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
  private onSelect!: (id: string, difficulty: DifficultyId) => void
  private onPractice!: (id: string, difficulty: DifficultyId) => void
  private onRestart!: () => void
  private onMenu!: () => void
  private mutedBtn: HTMLElement
  private muted = false
  onFullscreen = (): void => {}
  selected: string = 'blaster'
  difficulty: DifficultyId = DEFAULT_DIFFICULTY

  constructor() {
    const app = document.getElementById('app')!

    this.menu = document.createElement('div')
    this.menu.className = 'screen'
    this.menu.innerHTML = `
      <h1>SPLASH</h1>
      <p class="tagline">Twin-stick arena brawl. Move with your left thumb, aim &amp; fire with your right.</p>
      <div class="row">
        <button class="btn" id="btn-play">▶ Play</button>
        <button class="btn ghost icon" id="btn-mute">🔊</button>
        <button class="btn ghost icon" id="btn-fs">⛶</button>
      </div>
      <div class="version" id="app-version"></div>
    `
    app.appendChild(this.menu)
    this.menu.querySelector('#app-version')!.textContent = `v${APP_VERSION}`

    this.select = document.createElement('div')
    this.select.className = 'screen hidden'
    this.select.innerHTML = `
      <h1 style="font-size:clamp(30px,8vw,48px)">Pick your brawler</h1>
      <div class="picker">
        <div class="preview" id="preview">
          <div class="preview-icon" id="preview-icon"><span class="glyph"></span></div>
          <div class="preview-info">
            <div class="preview-name" id="preview-name"></div>
            <div class="preview-desc" id="preview-desc"></div>
          </div>
        </div>
        <div class="brawler-strip" id="brawler-strip"></div>
      </div>
      <div class="row">
        <span class="diff-label">Bot difficulty</span>
        <span class="diff-btns" id="diff-row"></span>
      </div>
      <div class="row">
        <button class="btn" id="btn-fight">⚔ Brawl</button>
        <button class="btn ghost" id="btn-practice">🎯 Practice</button>
        <button class="btn ghost" id="btn-back">← Back</button>
      </div>
    `
    app.appendChild(this.select)

    const strip = this.select.querySelector('#brawler-strip')!
    const previewIcon = this.select.querySelector('#preview-icon') as HTMLElement
    const previewName = this.select.querySelector('#preview-name') as HTMLElement
    const previewDesc = this.select.querySelector('#preview-desc') as HTMLElement
    const cards: HTMLElement[] = []
    const renderPreview = (def: BrawlerDef): void => {
      previewIcon.style.background = def.color
      previewIcon.querySelector('.glyph')!.textContent = def.glyph
      previewName.textContent = def.name
      previewDesc.textContent = statLine(def)
    }
    for (const def of Object.values(BRAWLER_DEFS)) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'brawler-card'
      card.dataset.id = def.id
      card.title = def.name
      card.innerHTML = `<span class="brawler-icon" style="background:${def.color}"><span class="glyph">${def.glyph}</span></span>`
      card.addEventListener('click', () => {
        this.selected = def.id
        for (const c of cards) c.classList.toggle('selected', c === card)
        renderPreview(def)
      })
      cards.push(card)
      strip.appendChild(card)
    }
    renderPreview(BRAWLER_DEFS[this.selected])
    cards[0].classList.add('selected')

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

    const diffRow = this.select.querySelector('#diff-row')!
    const diffBtns: HTMLElement[] = []
    for (const d of Object.values(DIFFICULTIES)) {
      const b = document.createElement('button')
      b.className = `btn ghost diff${d.id === this.difficulty ? ' selected' : ''}`
      b.dataset.diff = d.id
      b.textContent = d.label
      b.addEventListener('click', () => {
        this.difficulty = d.id
        for (const other of diffBtns) other.classList.toggle('selected', other === b)
      })
      diffBtns.push(b)
      diffRow.appendChild(b)
    }

    this.menu.querySelector('#btn-play')!.addEventListener('click', () => {
      this.menu.classList.add('hidden')
      this.select.classList.remove('hidden')
    })
    this.mutedBtn.addEventListener('click', () => {
      this.muted = !this.muted
      this.mutedBtn.textContent = this.muted ? '🔇' : '🔊'
      this.onMute(this.muted)
    })
    this.menu.querySelector('#btn-fs')!.addEventListener('click', () => {
      this.onFullscreen()
    })
    this.select.querySelector('#btn-fight')!.addEventListener('click', () => {
      this.hideAll()
      this.onSelect(this.selected, this.difficulty)
    })
    this.select.querySelector('#btn-practice')!.addEventListener('click', () => {
      this.hideAll()
      this.onPractice(this.selected, this.difficulty)
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

  onSelectCb = (fn: (id: string, difficulty: DifficultyId) => void): void => {
    this.onSelect = fn
  }
  onPracticeCb = (fn: (id: string, difficulty: DifficultyId) => void): void => {
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
