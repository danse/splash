import { runDuel } from '../src/sim/duel'

export interface WorkerJob {
  pair: string
  n: number
  seed: number
  ablate: string | null
  pickups: boolean
  duration: number
}

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || i + 1 >= process.argv.length) return def
  const v = process.argv[i + 1]
  return v.startsWith('--') ? def : v
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

export function parseWorkerJob(argv: string[]): WorkerJob {
  const read = (name: string, def: string): string => {
    const i = argv.indexOf(`--${name}`)
    if (i === -1 || i + 1 >= argv.length) return def
    const v = argv[i + 1]
    return v.startsWith('--') ? def : v
  }
  return {
    pair: read('pair', 'blaster:charger'),
    n: parseInt(read('n', '50'), 10) || 50,
    seed: parseInt(read('seed', '1'), 10) || 1,
    ablate: read('ablate', '') || null,
    pickups: argv.includes('--pickups'),
    duration: parseInt(read('duration', '120'), 10) || 120,
  }
}

function main(): void {
  const job = parseWorkerJob(process.argv.slice(2))
  const [aDefId, bDefId] = job.pair.split(':')
  if (!aDefId || !bDefId) {
    process.stderr.write(`bad pair ${job.pair}\n`)
    process.exit(1)
  }
  for (let i = 0; i < job.n; i++) {
    const outcome = runDuel(job.seed + i, aDefId, bDefId, {
      ablate: job.ablate,
      pickups: job.pickups,
      duration: job.duration,
    })
    process.stdout.write(JSON.stringify(outcome) + '\n')
  }
}

main()
