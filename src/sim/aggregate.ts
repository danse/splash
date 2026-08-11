import type { DuelOutcome } from './metrics'

export interface MatchupStats {
  a: string
  b: string
  n: number
  winsA: number
  winsB: number
  draws: number
  winRateA: number
  drawRate: number
  avgDuration: number
  avgKillsA: number
  avgKillsB: number
  avgDeathsA: number
  avgDeathsB: number
  avgDamageA: number
  avgDamageB: number
  avgShotsA: number
  avgShotsB: number
  avgHitsA: number
  avgHitsB: number
  accuracyA: number
  accuracyB: number
  avgSupersA: number
  avgSupersB: number
  avgHpLeftA: number
  avgHpLeftB: number
}

export interface ArchetypeStats {
  id: string
  n: number
  wins: number
  losses: number
  draws: number
  winRate: number
  avgKills: number
  avgDeaths: number
  avgDamage: number
  avgShots: number
  avgHits: number
  accuracy: number
  avgSupers: number
  avgDuration: number
}

export interface AblationStats {
  archetype: string
  reference: string
  ablation: string
  baseWinRate: number
  ablatedWinRate: number
  delta: number
  baseN: number
  ablatedN: number
}

export function aggregateMatchups(duels: DuelOutcome[]): MatchupStats[] {
  const byPair = new Map<string, DuelOutcome[]>()
  for (const d of duels) {
    const key = d.pairId
    const arr = byPair.get(key)
    if (arr) arr.push(d)
    else byPair.set(key, [d])
  }

  const out: MatchupStats[] = []
  for (const [pairId, ds] of byPair) {
    const [a, b] = pairId.split(':')
    const n = ds.length
    let winsA = 0
    let winsB = 0
    let draws = 0
    let kA = 0
    let kB = 0
    let dA = 0
    let dB = 0
    let dmA = 0
    let dmB = 0
    let shA = 0
    let shB = 0
    let hiA = 0
    let hiB = 0
    let suA = 0
    let suB = 0
    let hpA = 0
    let hpB = 0
    let dur = 0
    for (const d of ds) {
      if (d.winner === 'a') winsA++
      else if (d.winner === 'b') winsB++
      else draws++
      kA += d.aKills
      kB += d.bKills
      dA += d.aDeaths
      dB += d.bDeaths
      dmA += d.aDamage
      dmB += d.bDamage
      shA += d.aShots
      shB += d.bShots
      hiA += d.aHits
      hiB += d.bHits
      suA += d.aSupers
      suB += d.bSupers
      hpA += d.aHpLeft
      hpB += d.bHpLeft
      dur += d.duration
    }
    out.push({
      a,
      b,
      n,
      winsA,
      winsB,
      draws,
      winRateA: winsA / n,
      drawRate: draws / n,
      avgDuration: dur / n,
      avgKillsA: kA / n,
      avgKillsB: kB / n,
      avgDeathsA: dA / n,
      avgDeathsB: dB / n,
      avgDamageA: dmA / n,
      avgDamageB: dmB / n,
      avgShotsA: shA / n,
      avgShotsB: shB / n,
      avgHitsA: hiA / n,
      avgHitsB: hiB / n,
      accuracyA: shA > 0 ? hiA / shA : 0,
      accuracyB: shB > 0 ? hiB / shB : 0,
      avgSupersA: suA / n,
      avgSupersB: suB / n,
      avgHpLeftA: hpA / n,
      avgHpLeftB: hpB / n,
    })
  }
  return out.sort((x, y) => (x.a === y.a ? x.b.localeCompare(y.b) : x.a.localeCompare(y.a)))
}

export function archetypeOverview(duels: DuelOutcome[]): ArchetypeStats[] {
  const ids = new Set<string>()
  for (const d of duels) {
    ids.add(d.aDefId)
    ids.add(d.bDefId)
  }
  const stats: ArchetypeStats[] = []
  for (const id of ids) {
    let n = 0
    let wins = 0
    let losses = 0
    let draws = 0
    let kills = 0
    let deaths = 0
    let damage = 0
    let shots = 0
    let hits = 0
    let supers = 0
    let dur = 0
    for (const d of duels) {
      let mine = false
      if (d.aDefId === id) {
        mine = true
        n++
        kills += d.aKills
        deaths += d.aDeaths
        damage += d.aDamage
        shots += d.aShots
        hits += d.aHits
        supers += d.aSupers
      } else if (d.bDefId === id) {
        mine = true
        n++
        kills += d.bKills
        deaths += d.bDeaths
        damage += d.bDamage
        shots += d.bShots
        hits += d.bHits
        supers += d.bSupers
      }
      if (!mine) continue
      if (d.winner === 'draw') draws++
      else if ((d.aDefId === id && d.winner === 'a') || (d.bDefId === id && d.winner === 'b')) wins++
      else losses++
      dur += d.duration
    }
    stats.push({
      id,
      n,
      wins,
      losses,
      draws,
      winRate: (wins + draws * 0.5) / n,
      avgKills: kills / n,
      avgDeaths: deaths / n,
      avgDamage: damage / n,
      avgShots: shots / n,
      avgHits: hits / n,
      accuracy: shots > 0 ? hits / shots : 0,
      avgSupers: supers / n,
      avgDuration: dur / n,
    })
  }
  return stats.sort((a, b) => b.winRate - a.winRate)
}

export function ablationOverview(
  duels: DuelOutcome[],
  reference: string,
  ablation: string,
): AblationStats[] {
  const targets = new Set<string>()
  for (const d of duels) {
    if (d.aDefId === reference) continue
    targets.add(d.aDefId)
  }
  const out: AblationStats[] = []
  for (const arch of targets) {
    const base: DuelOutcome[] = []
    const ablated: DuelOutcome[] = []
    for (const d of duels) {
      if (d.aDefId !== arch || d.bDefId !== reference) continue
      if (d.ablate) ablated.push(d)
      else base.push(d)
    }
    const baseN = base.length
    const ablatedN = ablated.length
    if (baseN === 0 || ablatedN === 0) continue
    const baseWinRate = base.filter((d) => d.winner === 'a').length / baseN
    const ablatedWinRate = ablated.filter((d) => d.winner === 'a').length / ablatedN
    out.push({
      archetype: arch,
      reference,
      ablation,
      baseWinRate,
      ablatedWinRate,
      delta: ablatedWinRate - baseWinRate,
      baseN,
      ablatedN,
    })
  }
  return out.sort((a, b) => a.delta - b.delta)
}
