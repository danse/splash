import { Simulation } from './simulation'
import { mulberry32 } from '../core/math'
import type { BrainOpts } from '../entities/bot'
import type { DuelOutcome } from './metrics'

export interface DuelOpts {
  duration: number
  countdown: number
  endDelay: number
  pickups: boolean
  brainA: BrainOpts
  brainB: BrainOpts
  ablate: keyof BrainOpts | null
}

export const DEFAULT_DUEL_OPTS: DuelOpts = {
  duration: 120,
  countdown: 0,
  endDelay: 0.1,
  pickups: false,
  brainA: {},
  brainB: {},
  ablate: null,
}

const DT = 1 / 60

export function runDuel(seed: number, aDefId: string, bDefId: string, opts: Partial<DuelOpts> = {}): DuelOutcome {
  const o = { ...DEFAULT_DUEL_OPTS, ...opts }
  const brainA: BrainOpts = o.ablate ? { [o.ablate]: true } : {}
  const realRandom = Math.random
  Math.random = mulberry32((seed >>> 0) ^ 0x5f356495)
  try {
    const sim = new Simulation(seed, {
      attackers: 2,
      respawn: false,
      timer: false,
      endMatch: true,
      endOnLastDeath: true,
      duration: o.duration,
      countdown: o.countdown,
      endDelay: o.endDelay,
      focusPlayer: false,
      dummyBots: false,
      spawnCount: 2,
      modeId: 'duel',
    })
    const a = sim.addBot(aDefId, undefined, undefined, brainA)
    const b = sim.addBot(bDefId, undefined, undefined, o.brainB)
    if (o.pickups) sim.addDefaultPickups()

    let dmgA = 0
    let dmgB = 0
    let shotsA = 0
    let shotsB = 0
    let hitsA = 0
    let hitsB = 0
    let supersA = 0
    let supersB = 0

    const superProjectiles = (def: typeof a.def): number =>
      def.superType === 'storm' ? 7 : def.superType === 'boulder' ? 1 : 0

    sim.events.fire = (bb, kind) => {
      const extra = kind === 'super' ? superProjectiles(bb.def) : 1
      if (bb === a) shotsA += extra
      else shotsB += extra
    }
    sim.events.hit = (att, _tgt, dmg) => {
      if (att === a) {
        hitsA++
        dmgA += dmg
      } else {
        hitsB++
        dmgB += dmg
      }
    }
    sim.events.super = (bb) => {
      if (bb === a) supersA++
      else supersB++
    }

    let done = false
    let outcome: DuelOutcome | null = null
    sim.onEnd = (r) => {
      done = true
      const aAlive = a.alive
      const bAlive = b.alive
      let winner: 'a' | 'b' | 'draw'
      if (aAlive && !bAlive) winner = 'a'
      else if (bAlive && !aAlive) winner = 'b'
      else winner = 'draw'
      outcome = {
        pairId: `${aDefId}:${bDefId}`,
        aDefId,
        bDefId,
        ablate: o.ablate,
        winner,
        reason: r.time >= o.duration ? 'timeout' : 'kill',
        duration: r.time,
        aKills: bAlive ? 0 : 1,
        bKills: aAlive ? 0 : 1,
        aDeaths: aAlive ? 0 : 1,
        bDeaths: bAlive ? 0 : 1,
        aDamage: Math.round(dmgA),
        bDamage: Math.round(dmgB),
        aShots: shotsA,
        bShots: shotsB,
        aHits: hitsA,
        bHits: hitsB,
        aSupers: supersA,
        bSupers: supersB,
        aHpLeft: aAlive ? Math.round(a.hp) : 0,
        bHpLeft: bAlive ? Math.round(b.hp) : 0,
      }
    }

    const maxFrames = Math.ceil((o.duration + o.countdown + o.endDelay + 2) / DT)
    for (let i = 0; i < maxFrames && !done; i++) {
      sim.step(DT)
    }

    if (!outcome) {
      outcome = {
        pairId: `${aDefId}:${bDefId}`,
        aDefId,
        bDefId,
        ablate: o.ablate,
        winner: 'draw',
        reason: 'timeout',
        duration: sim.time,
        aKills: 0,
        bKills: 0,
        aDeaths: a.alive ? 0 : 1,
        bDeaths: b.alive ? 0 : 1,
        aDamage: Math.round(dmgA),
        bDamage: Math.round(dmgB),
        aShots: shotsA,
        bShots: shotsB,
        aHits: hitsA,
        bHits: hitsB,
        aSupers: supersA,
        bSupers: supersB,
        aHpLeft: a.alive ? Math.round(a.hp) : 0,
        bHpLeft: b.alive ? Math.round(b.hp) : 0,
      }
    }
    return outcome
  } finally {
    Math.random = realRandom
  }
}
