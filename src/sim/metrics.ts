export interface DuelOutcome {
  pairId: string
  aDefId: string
  bDefId: string
  ablate: string | null
  winner: 'a' | 'b' | 'draw'
  reason: 'kill' | 'timeout'
  duration: number
  aKills: number
  bKills: number
  aDeaths: number
  bDeaths: number
  aDamage: number
  bDamage: number
  aShots: number
  bShots: number
  aHits: number
  bHits: number
  aSupers: number
  bSupers: number
  aHpLeft: number
  bHpLeft: number
}
