let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

export function initAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  try {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
}

export function setMuted(m: boolean): void {
  muted = m
  if (master) master.gain.value = m ? 0 : 0.5
}

export function isMuted(): boolean {
  return muted
}

const sfxBuffers = new Map<string, AudioBuffer>()

export async function preloadAudio(): Promise<void> {
  initAudio()
  if (!ctx) return
  const base = import.meta.env.BASE_URL ?? '/'
  const files: [string, string][] = [
    ['shoot', `${base}assets/audio/laser1.ogg`],
    ['swing', `${base}assets/audio/impactWood_medium_000.ogg`],
    ['super', `${base}assets/audio/phaserUp1.ogg`],
    ['hit', `${base}assets/audio/impactTin_medium_000.ogg`],
    ['hurt', `${base}assets/audio/impactBell_heavy_000.ogg`],
    ['dashHit', `${base}assets/audio/impactGlass_heavy_000.ogg`],
    ['kill', `${base}assets/audio/spaceTrash1.ogg`],
    ['death', `${base}assets/audio/lowDown.ogg`],
    ['pickup', `${base}assets/audio/powerUp1.ogg`],
    ['ready', `${base}assets/audio/highUp.ogg`],
    ['win', `${base}assets/audio/threeTone1.ogg`],
    ['lose', `${base}assets/audio/lowThreeTone.ogg`],
  ]
  await Promise.all(
    files.map(async ([name, url]) => {
      const resp = await fetch(url)
      const buf = await resp.arrayBuffer()
      const audioBuffer = await ctx!.decodeAudioData(buf)
      sfxBuffers.set(name, audioBuffer)
    })
  )
}

function playSound(name: string, vol = 0.5, delay = 0, rate = 1): void {
  if (!ctx || !master || muted) return
  const buffer = sfxBuffers.get(name)
  if (!buffer) return
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, ctx.currentTime + delay)
  src.connect(g)
  g.connect(master)
  src.start(ctx.currentTime + delay)
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  slideTo?: number,
  delay = 0,
): void {
  if (!ctx || !master || muted) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(dur: number, vol: number, filterFreq: number, slideTo?: number, delay = 0): void {
  if (!ctx || !master || muted) return
  const t0 = ctx.currentTime + delay
  const len = Math.floor(ctx.sampleRate * dur)
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFreq, t0)
  if (slideTo !== undefined) filter.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + dur)
}

export const sfx = {
  shoot(colorIdx = 0): void {
    playSound('shoot', 0.45, 0, 1 + colorIdx * 0.1)
  },
  swing(_colorIdx = 0): void {
    playSound('swing', 0.4)
  },
  super(_colorIdx = 0): void {
    playSound('super', 0.5)
  },
  hit(): void {
    playSound('hit', 0.35)
  },
  hurt(): void {
    playSound('hurt', 0.4)
  },
  dash(): void {
    noise(0.32, 0.28, 5000, 300)
    tone(260, 0.3, 'sawtooth', 0.12, 520)
  },
  pickup(): void {
    playSound('pickup', 0.4)
  },
  kill(): void {
    playSound('kill', 0.45)
  },
  death(): void {
    playSound('death', 0.4)
  },
  dashHit(): void {
    playSound('dashHit', 0.4)
  },
  ready(): void {
    playSound('ready', 0.4)
  },
  win(): void {
    playSound('win', 0.45)
  },
  lose(): void {
    playSound('lose', 0.4)
  },
}
