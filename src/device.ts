export function isTouchDevice(): boolean {
  try {
    const coarse = window.matchMedia('(pointer: coarse)')
    if (coarse && typeof coarse.matches === 'boolean') return coarse.matches
  } catch {
    /* matchMedia unavailable (jsdom / older browsers) */
  }
  return navigator.maxTouchPoints > 0
}

export function isLandscape(): boolean {
  return window.innerWidth >= window.innerHeight
}

function makeOverlay(id: string, icon: string, title: string, text: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'device-overlay'
  el.id = id
  el.innerHTML = `
    <div class="device-icon">${icon}</div>
    <h2>${title}</h2>
    <p>${text}</p>
  `
  return el
}

export function initDeviceGate(): void {
  const app = document.getElementById('app')
  if (!app) return

  if (!isTouchDevice()) {
    app.appendChild(
      makeOverlay(
        'overlay-desktop',
        '🖥️',
        'Touch screen required',
        'SPLASH requires a touch screen device. Open it on your phone or tablet.',
      ),
    )
    return
  }

  const rotate = makeOverlay(
    'overlay-rotate',
    '📱',
    'Rotate your device',
    'SPLASH is best played in landscape.',
  )
  rotate.classList.add('hidden')
  app.appendChild(rotate)

  const update = (): void => {
    rotate.classList.toggle('hidden', isLandscape())
  }
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
}

export function lockLandscape(): void {
  try {
    const o = (screen as unknown as { orientation?: { lock?: (m: string) => Promise<unknown> } }).orientation
    if (o?.lock) o.lock('landscape').catch(() => {})
  } catch {
    /* orientation lock unsupported */
  }
}
