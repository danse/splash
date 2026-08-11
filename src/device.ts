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

type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => void }
type FullscreenDoc = Document & { webkitExitFullscreen?: () => void }

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
  )
}

export async function requestFullscreen(): Promise<void> {
  try {
    const el = document.documentElement as FullscreenEl
    if (el.requestFullscreen) await el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  } catch {
    /* fullscreen blocked / unsupported */
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    const doc = document as FullscreenDoc
    if (doc.exitFullscreen) await doc.exitFullscreen()
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen()
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen()
  else await requestFullscreen()
}
