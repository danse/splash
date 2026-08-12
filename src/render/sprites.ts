export interface Sprite {
  img: CanvasImageSource
  w: number
  h: number
}

const registry = new Map<string, Sprite>()

export function loadSprite(name: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      registry.set(name, { img, w: img.naturalWidth, h: img.naturalHeight })
      resolve()
    }
    img.onerror = () => reject(new Error(`failed to load sprite ${url}`))
    img.src = url
  })
}

export function getSprite(name: string): Sprite | undefined {
  return registry.get(name)
}

export async function preloadSprites(): Promise<void> {
  const base = import.meta.env.BASE_URL ?? '/'
  const list: Array<[string, string]> = [
    ['blaster', `${base}assets/sprites/soldier1_stand.png`],
    ['blaster-fire', `${base}assets/sprites/soldier1_gun.png`],
    ['charger', `${base}assets/sprites/hitman1_stand.png`],
    ['charger-fire', `${base}assets/sprites/hitman1_gun.png`],
    ['tank', `${base}assets/sprites/tankGreen.png`],
    ['tank-barrel', `${base}assets/sprites/barrelGreen.png`],
  ]
  await Promise.all(list.map(([name, url]) => loadSprite(name, url)))
}

export function setSpriteForTest(name: string, w: number, h: number): void {
  registry.set(name, { img: {} as CanvasImageSource, w, h })
}

export function resetSpritesForTest(): void {
  registry.clear()
}
