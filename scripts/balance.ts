import { spawn, type ChildProcess } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cpus } from 'node:os'
import { aggregateMatchups, archetypeOverview, ablationOverview, type MatchupStats } from '../src/sim/aggregate'
import type { DuelOutcome } from '../src/sim/metrics'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..')
const WORKER = join(SCRIPT_DIR, 'balance.worker.ts')
const VITE_NODE = join(REPO_ROOT, 'node_modules', '.bin', 'vite-node')

const ARCHETYPES = ['blaster', 'charger', 'tank']
const ABLATIONS = ['turret', 'nosuper', 'noretreat', 'perfectaim']

interface CliOptions {
  n: number
  seed: number
  pairs: string[]
  ablate: string | null
  ref: string
  targets: string[]
  pickups: boolean
  workers: number
  json: string | null
  duration: number
}

function readArg(argv: string[], name: string, def: string): string {
  const i = argv.indexOf(`--${name}`)
  if (i === -1 || i + 1 >= argv.length) return def
  const v = argv[i + 1]
  return v.startsWith('--') ? def : v
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`)
}

function parseOptions(argv: string[]): CliOptions {
  const ablateRaw = readArg(argv, 'ablate', '')
  const ablate = ablateRaw && ABLATIONS.includes(ablateRaw) ? ablateRaw : null
  const pairsRaw = readArg(argv, 'pairs', '')
  const targetsRaw = readArg(argv, 'targets', '')
  const defaultPairs = ARCHETYPES.flatMap((a) => ARCHETYPES.filter((b) => b !== a).map((b) => `${a}:${b}`))
  const pairs = pairsRaw
    ? pairsRaw
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.includes(':'))
    : defaultPairs
  const targets = targetsRaw
    ? targetsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : ARCHETYPES.filter((a) => a !== readArg(argv, 'ref', 'charger'))
  return {
    n: parseInt(readArg(argv, 'n', '100'), 10) || 100,
    seed: parseInt(readArg(argv, 'seed', '1'), 10) || 1,
    pairs,
    ablate,
    ref: readArg(argv, 'ref', 'charger'),
    targets,
    pickups: hasFlag(argv, 'pickups'),
    workers: Math.max(1, parseInt(readArg(argv, 'workers', String(Math.min(4, cpus().length))), 10) || 1),
    json: readArg(argv, 'json', '') || null,
    duration: parseInt(readArg(argv, 'duration', '120'), 10) || 120,
  }
}

interface Job {
  pair: string
  ablate: string | null
}

function buildJobs(o: CliOptions): Job[] {
  if (o.ablate) {
    return o.targets.flatMap((t) => [
      { pair: `${t}:${o.ref}`, ablate: o.ablate },
      { pair: `${t}:${o.ref}`, ablate: null },
    ])
  }
  return o.pairs.map((p) => ({ pair: p, ablate: null }))
}

function spawnWorker(job: Job, o: CliOptions): Promise<DuelOutcome[]> {
  return new Promise((resolve, reject) => {
    const args = [
      WORKER,
      '--pair', job.pair,
      '--n', String(o.n),
      '--seed', String(o.seed),
      '--duration', String(o.duration),
    ]
    if (job.ablate) args.push('--ablate', job.ablate)
    if (o.pickups) args.push('--pickups')

    const child: ChildProcess = spawn(VITE_NODE, args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const duels: DuelOutcome[] = []
    let errBuf = ''
    child.stdout.on('data', (buf: Buffer) => {
      const text = buf.toString()
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          duels.push(JSON.parse(trimmed) as DuelOutcome)
        } catch {
          process.stderr.write(`[worker ${job.pair}] ignoring non-JSON line\n`)
        }
      }
    })
    child.stderr.on('data', (buf: Buffer) => {
      errBuf += buf.toString()
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`worker ${job.pair} exited ${code}: ${errBuf.trim()}`))
      } else {
        resolve(duels)
      }
    })
  })
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length)
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function printMatchupTable(duels: DuelOutcome[]): void {
  const stats = aggregateMatchups(duels)
  const header = ['A', 'B', 'n', 'A win%', 'B win%', 'draw%', 'dur(s)', 'kA/kB', 'dmgA/dmgB', 'h/sA/h/sB', 'superA/B', 'hpA/hpB']
  const widths = header.map((h) => h.length)
  const rows = stats.map((m) => [
    m.a,
    m.b,
    String(m.n),
    fmtPct(m.winRateA),
    fmtPct(1 - m.winRateA - m.drawRate),
    fmtPct(m.drawRate),
    m.avgDuration.toFixed(1),
    `${m.avgKillsA.toFixed(2)}/${m.avgKillsB.toFixed(2)}`,
    `${Math.round(m.avgDamageA)}/${Math.round(m.avgDamageB)}`,
    `${fmtPct(m.accuracyA)}/${fmtPct(m.accuracyB)}`,
    `${m.avgSupersA.toFixed(1)}/${m.avgSupersB.toFixed(1)}`,
    `${Math.round(m.avgHpLeftA)}/${Math.round(m.avgHpLeftB)}`,
  ])
  for (const r of rows) {
    r.forEach((c, i) => {
      widths[i] = Math.max(widths[i], c.length)
    })
  }
  console.log(header.map((h, i) => pad(h, widths[i])).join(' | '))
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'))
  for (const r of rows) {
    console.log(r.map((c, i) => pad(c, widths[i])).join(' | '))
  }
}

function printOverview(duels: DuelOutcome[]): void {
  const stats = archetypeOverview(duels)
  console.log('')
  console.log('Archetype overview (draws count as half-wins)')
  const header = ['archetype', 'n', 'win%', 'W', 'L', 'D', 'kills', 'deaths', 'dmg', 'h/s', 'supers', 'dur(s)']
  const widths = header.map((h) => h.length)
  const rows = stats.map((s) => [
    s.id,
    String(s.n),
    fmtPct(s.winRate),
    String(s.wins),
    String(s.losses),
    String(s.draws),
    s.avgKills.toFixed(2),
    s.avgDeaths.toFixed(2),
    String(Math.round(s.avgDamage)),
    fmtPct(s.accuracy),
    s.avgSupers.toFixed(1),
    s.avgDuration.toFixed(1),
  ])
  for (const r of rows) r.forEach((c, i) => (widths[i] = Math.max(widths[i], c.length)))
  console.log(header.map((h, i) => pad(h, widths[i])).join(' | '))
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'))
  for (const r of rows) console.log(r.map((c, i) => pad(c, widths[i])).join(' | '))
}

function printAblationTable(duels: DuelOutcome[], o: CliOptions): void {
  const stats = ablationOverview(duels, o.ref, o.ablate!)
  console.log(`Ablation: ${o.ablate!} applied to side A vs reference "${o.ref}" (side B)`)
  const header = ['archetype', 'base win%', 'ablated win%', 'delta', 'n']
  const widths = header.map((h) => h.length)
  const rows = stats.map((s) => [
    s.archetype,
    fmtPct(s.baseWinRate),
    fmtPct(s.ablatedWinRate),
    `${s.delta >= 0 ? '+' : ''}${fmtPct(s.delta)}`,
    `${s.baseN}/${s.ablatedN}`,
  ])
  for (const r of rows) r.forEach((c, i) => (widths[i] = Math.max(widths[i], c.length)))
  console.log(header.map((h, i) => pad(h, widths[i])).join(' | '))
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'))
  for (const r of rows) console.log(r.map((c, i) => pad(c, widths[i])).join(' | '))
  console.log('')
  console.log('delta = ablated win% - base win%; negative means the capability helps the archetype')
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const o = parseOptions(argv)
  const jobs = buildJobs(o)

  console.log(`splash balance harness`)
  console.log(`duels per pair: ${o.n} | base seed: ${o.seed} | workers: ${o.workers} | pickups: ${o.pickups ? 'on' : 'off'}`)
  console.log(`jobs: ${jobs.map((j) => j.pair + (j.ablate ? `[${j.ablate}]` : '')).join(', ')}`)
  console.log('')

  const duels: DuelOutcome[] = []
  const queue = [...jobs]
  let running = 0
  const failures: string[] = []

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (running < o.workers && queue.length > 0) {
        const job = queue.shift()!
        running++
        spawnWorker(job, o)
          .then((ds) => {
            duels.push(...ds)
            process.stderr.write(`done ${job.pair}${job.ablate ? `[${job.ablate}]` : ''} (${ds.length} duels)\n`)
          })
          .catch((err) => {
            failures.push(String(err))
            process.stderr.write(`failed ${job.pair}: ${String(err)}\n`)
          })
          .finally(() => {
            running--
            pump()
          })
      }
      if (running === 0 && queue.length === 0) resolve()
    }
    pump()
  })

  if (duels.length === 0) {
    process.stderr.write('no duels collected\n')
    if (failures.length) process.stderr.write(failures.join('\n') + '\n')
    process.exit(1)
  }

  if (o.ablate) {
    printAblationTable(duels, o)
    printOverview(duels)
  } else {
    printMatchupTable(duels)
    printOverview(duels)
  }

  if (o.json) {
    const payload = {
      config: {
        n: o.n,
        seed: o.seed,
        pairs: o.pairs,
        ablate: o.ablate,
        ref: o.ref,
        targets: o.targets,
        pickups: o.pickups,
        duration: o.duration,
      },
      matchups: o.ablate ? null : aggregateMatchups(duels),
      overview: archetypeOverview(duels),
      ablation: o.ablate ? ablationOverview(duels, o.ref, o.ablate) : null,
    }
    writeFileSync(o.json, JSON.stringify(payload, null, 2) + '\n')
    console.log(`\nwrote ${o.json}`)
  }
}

void main()
