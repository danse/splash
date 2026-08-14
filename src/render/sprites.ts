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
    ['charger', `${base}assets/sprites/robot1_stand.png`],
    ['charger-fire', `${base}assets/sprites/robot1_gun.png`],
    ['tank', `${base}assets/sprites/tankGreen.png`],
    ['tank-barrel', `${base}assets/sprites/barrelGreen.png`],
    ['sniper', `${base}assets/sprites/hitman1_stand.png`],
    ['sniper-fire', `${base}assets/sprites/hitman1_gun.png`],
    ['gunner', `${base}assets/sprites/manBlue_stand.png`],
    ['gunner-fire', `${base}assets/sprites/manBlue_gun.png`],
    ['ranger', `${base}assets/sprites/manBrown_stand.png`],
    ['ranger-fire', `${base}assets/sprites/manBrown_gun.png`],
    ['scout', `${base}assets/sprites/survivor1_stand.png`],
    ['scout-fire', `${base}assets/sprites/survivor1_gun.png`],
    ['assassin', `${base}assets/sprites/womanGreen_stand.png`],
    ['assassin-fire', `${base}assets/sprites/womanGreen_gun.png`],
    ['bruiser', `${base}assets/sprites/zoimbie1_stand.png`],
    ['juggernaut', `${base}assets/sprites/tankBlue.png`],
    ['juggernaut-barrel', `${base}assets/sprites/barrelBlue.png`],
    ['demolisher', `${base}assets/sprites/tankRed.png`],
    ['demolisher-barrel', `${base}assets/sprites/barrelRed.png`],
    ['raider', `${base}assets/sprites/manOld_stand.png`],
    ['raider-fire', `${base}assets/sprites/manOld_gun.png`],
  ]
  await Promise.all(list.map(([name, url]) => loadSprite(name, url)))
}

export function setSpriteForTest(name: string, w: number, h: number): void {
  registry.set(name, { img: {} as CanvasImageSource, w, h })
}

export function resetSpritesForTest(): void {
  registry.clear()
}
