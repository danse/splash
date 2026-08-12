// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { Screens, MatchResult } from './screens'

let screens: Screens
let selected: string | null
let restarts = 0
let menuReturns = 0

const result: MatchResult = {
  won: true,
  kills: 5,
  botsLeft: 0,
  time: 83,
  brawlerName: 'Blaster',
}

function byId(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement
}

function visible(el: HTMLElement | null): boolean {
  return !!el && !el.classList.contains('hidden')
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  selected = null
  restarts = 0
  menuReturns = 0
  screens = new Screens()
  screens.onSelectCb((id) => (selected = id))
  screens.onRestartCb(() => restarts++)
  screens.onMenuCb(() => {
    menuReturns++
    screens.showMenu()
  })
})

describe('Screens transitions', () => {
  it('starts on the menu with the other screens hidden', () => {
    expect(visible(document.querySelector('#app > .screen:first-child'))).toBe(true)
    expect(visible(document.querySelector('#app > .screen:nth-child(2)'))).toBe(false)
    expect(visible(document.querySelector('#app > .screen:nth-child(3)'))).toBe(false)
  })

  it('Play button reveals the brawler select screen', () => {
    byId('btn-play').click()
    expect(visible(document.querySelector('#app > .screen:first-child'))).toBe(false)
    expect(visible(document.querySelector('#app > .screen:nth-child(2)'))).toBe(true)
  })

  it('Brawl starts the match, fires onSelect, and hides every screen', () => {
    byId('btn-play').click()
    byId('btn-fight').click()
    expect(selected).toBe('blaster')
    const screensEls = document.querySelectorAll('#app > .screen')
    for (const el of screensEls) {
      expect(el.classList.contains('hidden')).toBe(true)
    }
  })

  it('Practice fires onPractice with the selected brawler and hides every screen', () => {
    let practiced: string | null = null
    screens.onPracticeCb((id) => (practiced = id))
    byId('btn-play').click()
    const tank = document.querySelector('.brawler-card[data-id="tank"]') as HTMLElement
    tank.click()
    byId('btn-practice').click()
    expect(practiced).toBe('tank')
    const screensEls = document.querySelectorAll('#app > .screen')
    for (const el of screensEls) {
      expect(el.classList.contains('hidden')).toBe(true)
    }
  })

  it('honors the card selection when starting a match', () => {
    byId('btn-play').click()
    const tank = document.querySelector('.brawler-card[data-id="tank"]') as HTMLElement
    tank.click()
    byId('btn-fight').click()
    expect(selected).toBe('tank')
  })

  it('updates the preview panel when a brawler is selected', () => {
    byId('btn-play').click()
    expect(byId('preview-name').textContent).toBe('Blaster')
    const tank = document.querySelector('.brawler-card[data-id="tank"]') as HTMLElement
    tank.click()
    expect(byId('preview-name').textContent).toBe('Tank')
    expect(byId('preview-desc').textContent).toContain('Boulder')
  })

  it('Back button on select returns to the menu', () => {
    byId('btn-play').click()
    byId('btn-back').click()
    expect(visible(document.querySelector('#app > .screen:first-child'))).toBe(true)
    expect(visible(document.querySelector('#app > .screen:nth-child(2)'))).toBe(false)
  })

  it('shows the results screen with stats', () => {
    screens.showResults(result)
    expect(visible(document.querySelector('#app > .screen:nth-child(3)'))).toBe(true)
    expect(byId('results-title').textContent).toBe('VICTORY!')
    expect(byId('results-stats').textContent).toContain('5')
  })

  it('Play again restarts the match and hides every screen', () => {
    screens.showResults(result)
    byId('btn-again').click()
    expect(restarts).toBe(1)
    const screensEls = document.querySelectorAll('#app > .screen')
    for (const el of screensEls) {
      expect(el.classList.contains('hidden')).toBe(true)
    }
  })

  it('Menu button from results returns to the menu', () => {
    screens.showResults(result)
    byId('btn-home').click()
    expect(menuReturns).toBe(1)
    expect(visible(document.querySelector('#app > .screen:first-child'))).toBe(true)
    expect(visible(document.querySelector('#app > .screen:nth-child(3)'))).toBe(false)
  })
})
