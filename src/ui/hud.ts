import { Input } from '../core/input'
import { sfx } from '../audio'

const MAX_SUPER_REACH = 62

export class Hud {
  root: HTMLElement
  private killsEl: HTMLElement
  private timerEl: HTMLElement
  private botsEl: HTMLElement
  private healthBar: HTMLElement
  private healthText: HTMLElement
  private superBar: HTMLElement
  private superBtn: HTMLButtonElement
  private superJoy: HTMLDivElement
  private superKnob: HTMLDivElement
  private exitBtn: HTMLElement
  private feed: HTMLElement
  private input: Input
  private superPressId = -1
  private superPressX = 0
  private superPressY = 0
  // superDown tracks the actual finger-down position so a tap near the edge
  // of the button doesn't get mistaken for a drag by the implied pointermove
  private superDownX = 0
  private superDownY = 0
  private superDragged = false
  private superAngle = 0

  constructor(input: Input, onExit: () => void) {
    this.input = input
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
      sfx.back()
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
    this.superBtn.addEventListener('pointerdown', this.onSuperDown)
    bottom.appendChild(this.superBtn)

    this.superJoy = document.createElement('div')
    this.superJoy.className = 'joy-base super hidden'
    this.superKnob = document.createElement('div')
    this.superKnob.className = 'joy-knob'
    this.superJoy.appendChild(this.superKnob)
    this.root.appendChild(this.superJoy)

    this.feed = document.createElement('div')
    this.feed.className = 'kill-feed'
    this.root.appendChild(this.feed)
  }

  private onSuperDown = (e: PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const r = this.superBtn.getBoundingClientRect()
    this.superPressId = e.pointerId
    this.superPressX = r.left + r.width / 2
    this.superPressY = r.top + r.height / 2
    this.superDownX = e.clientX
    this.superDownY = e.clientY
    this.superDragged = false
    this.superAngle = 0
    this.input.beginSuperAim()
    window.addEventListener('pointermove', this.onSuperMove)
    window.addEventListener('pointerup', this.onSuperUp)
    window.addEventListener('pointercancel', this.onSuperUp)
  }

  private onSuperMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.superPressId) return
    const dx = e.clientX - this.superDownX
    const dy = e.clientY - this.superDownY
    const dist = Math.hypot(dx, dy)
    if (dist > 10) this.superDragged = true
    const angle = Math.atan2(dy, dx)
    this.superAngle = angle
    this.input.aimSuper(angle)
    const kx = (dx / MAX_SUPER_REACH) * 64
    const ky = (dy / MAX_SUPER_REACH) * 64
    this.superKnob.style.transform = `translate3d(calc(-50% + ${kx}px), calc(-50% + ${ky}px), 0)`
    this.superJoy.classList.remove('hidden')
    this.superJoy.style.left = `${this.superPressX - 64}px`
    this.superJoy.style.top = `${this.superPressY - 64}px`
  }

  private onSuperUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.superPressId) return
    this.superJoy.classList.add('hidden')
    this.superKnob.style.transform = ''
    window.removeEventListener('pointermove', this.onSuperMove)
    window.removeEventListener('pointerup', this.onSuperUp)
    window.removeEventListener('pointercancel', this.onSuperUp)
    this.superPressId = -1
    this.input.endSuperAim()
    if (e.type === 'pointercancel') return
    if (this.superDragged) this.input.queueSuper(this.superAngle)
    else this.input.queueSuper()
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
