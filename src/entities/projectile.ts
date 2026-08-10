import { Brawler } from './brawler'

export interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  damage: number
  owner: Brawler
  friendly: boolean
  ttl: number
  isSuper: boolean
  color: string
  pierce: number
  trail: { x: number; y: number }[]
}

export function spawnProjectile(
  owner: Brawler,
  angle: number,
  speed: number,
  range: number,
  damage: number,
  size: number,
  color: string,
  friendly: boolean,
  isSuper: boolean,
  pierce = 0,
): Projectile {
  const muzzle = owner.r + size
  return {
    x: owner.pos.x + Math.cos(angle) * muzzle,
    y: owner.pos.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: size,
    damage,
    owner,
    friendly,
    ttl: range / speed,
    isSuper,
    color,
    pierce,
    trail: [],
  }
}
