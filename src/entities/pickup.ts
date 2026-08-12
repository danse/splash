export type PickupKind = 'heal' | 'power'

export interface Pickup {
  x: number
  y: number
  r: number
  kind: PickupKind
  amount: number
  active: boolean
  respawn: number
  pulse: number
}

export function makePickup(x: number, y: number, kind: PickupKind, amount: number): Pickup {
  return {
    x,
    y,
    r: 24,
    kind,
    amount,
    active: true,
    respawn: 0,
    pulse: Math.random() * 10,
  }
}
