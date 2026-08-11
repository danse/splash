export class Hud {
  root: HTMLElement
  private killsEl: HTMLElement
  private timerEl: HTMLElement
  private botsEl: HTMLElement
  private healthBar: HTMLElement
  private healthText: HTMLElement
  private superBar: HTMLElement
  private superBtn: HTMLButtonElement
  private exitBtn: HTMLElement
  private feed: HTMLElement

  constructor(onSuper: () => void, onExit: () => void) {
    this.root = document.createElement('div')
    this.root.id = 'hud'
    this.root.style.display = 'none'
    document.getElementById('app')!.appendChild(this.root)

    const top = document.createElement('div')
    top.className = 'top-bar'
    top.innerHTML = `
      <div class="kills"><span class="label">Kills</span><span id="kills-val">0</span></div>
      <div class="bots-left"><b id="bots-val">0</b>bots</div>
      <div class="timer" id="timer-val">2:00</div>
      <button class="hud-exit" id="btn-exit">✕</button>
    `
    this.root.appendChild(top)
    this.killsEl = top.querySelector('#kills-val') as HTMLElement
    this.timerEl = top.querySelector('#timer-val') as HTMLElement
    this.botsEl = top.querySelector('#bots-val') as HTMLElement
    this.exitBtn = top.querySelector('#btn-exit') as HTMLElement
    this.exitBtn.style.display = 'none'
    this.exitBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onExit()
    })

    const bottom = document.createElement('div')
    bottom.className = 'bottom-hud'
    bottom.innerHTML = `
      <div class="health-wrap"><div class="health-bar" id="health-bar"></div>
        <div class="health-text" id="health-text"></div></div>
      <div class="super-wrap"><div class="super-bar" id="super-bar"></div></div>
    `
    this.root.appendChild(bottom)
    this.healthBar = bottom.querySelector('#health-bar') as HTMLElement
    this.healthText = bottom.querySelector('#health-text') as HTMLElement
    this.superBar = bottom.querySelector('#super-bar') as HTMLElement

    this.superBtn = document.createElement('button')
    this.superBtn.className = 'super-btn'
    this.superBtn.textContent = '★'
    this.superBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      onSuper()
    })
    bottom.appendChild(this.superBtn)

    this.feed = document.createElement('div')
    this.feed.className = 'kill-feed'
    this.root.appendChild(this.feed)
  }

  show(): void {
    this.root.style.display = 'flex'
  }

  hide(): void {
    this.root.style.display = 'none'
  }

  showExit(show: boolean): void {
    this.exitBtn.style.display = show ? '' : 'none'
  }

  update(hp: number, maxHp: number, superCharge: number, superReady: boolean): void {
    const ratio = Math.max(0, hp / maxHp)
    this.healthBar.style.width = `${ratio * 100}%`
    this.healthBar.classList.toggle('low', ratio < 0.35)
    this.healthText.textContent = `${Math.max(0, Math.ceil(hp))}`
    this.superBar.style.width = `${Math.min(1, superCharge) * 100}%`
    this.superBar.classList.toggle('ready', superReady)
    this.superBtn.classList.toggle('ready', superReady)
  }

  setKills(n: number): void {
    this.killsEl.textContent = `${n}`
  }

  setBots(n: number): void {
    this.botsEl.textContent = `${n}`
  }

  setTimer(seconds: number): void {
    if (!Number.isFinite(seconds)) {
      this.timerEl.textContent = '∞'
      return
    }
    const s = Math.max(0, Math.ceil(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    this.timerEl.textContent = `${m}:${r.toString().padStart(2, '0')}`
  }

  addKill(name: string, killer: string): void {
    const item = document.createElement('div')
    item.className = 'kill-item'
    item.innerHTML = `<span class="k">${killer}</span> ⚔ ${name}`
    this.feed.appendChild(item)
    window.setTimeout(() => {
      if (item.parentElement) item.parentElement.removeChild(item)
    }, 3000)
    while (this.feed.children.length > 4) {
      this.feed.removeChild(this.feed.firstChild!)
    }
  }

  announce(text: string, gold = false): void {
    const el = document.createElement('div')
    el.className = `announce${gold ? ' gold' : ''}`
    el.textContent = text
    this.root.appendChild(el)
    window.setTimeout(() => el.remove(), 2300)
  }
}
