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
    tone(700 + colorIdx * 120, 0.12, 'triangle', 0.18, 220)
    noise(0.05, 0.08, 3000, 800)
  },
  swing(colorIdx = 0): void {
    noise(0.14, 0.2, 2000 + colorIdx * 300, 500)
    tone(320 + colorIdx * 50, 0.16, 'square', 0.14, 140)
  },
  super(colorIdx = 0): void {
    tone(320 + colorIdx * 60, 0.4, 'sawtooth', 0.3, 90)
    noise(0.35, 0.3, 2000, 200)
  },
  hit(): void {
    tone(180, 0.1, 'square', 0.16, 90)
    noise(0.06, 0.14, 1200, 300)
  },
  hurt(): void {
    tone(140, 0.16, 'sawtooth', 0.22, 70)
  },
  dash(): void {
    noise(0.32, 0.28, 5000, 300)
    tone(260, 0.3, 'sawtooth', 0.12, 520)
  },
  pickup(): void {
    tone(520, 0.09, 'triangle', 0.2)
    tone(780, 0.12, 'triangle', 0.2, undefined, 0.08)
  },
  kill(): void {
    tone(300, 0.5, 'sawtooth', 0.3, 50)
    noise(0.5, 0.34, 800, 120)
  },
  death(): void {
    noise(0.7, 0.4, 400, 60)
    tone(120, 0.5, 'square', 0.24, 40)
  },
  dashHit(): void {
    tone(520, 0.12, 'square', 0.22, 180)
    noise(0.1, 0.2, 1600, 300)
  },
  ready(): void {
    tone(440, 0.12, 'triangle', 0.2)
    tone(660, 0.12, 'triangle', 0.2, undefined, 0.09)
  },
  win(): void {
    tone(392, 0.16, 'triangle', 0.25)
    tone(523, 0.16, 'triangle', 0.25, undefined, 0.14)
    tone(659, 0.3, 'triangle', 0.25, undefined, 0.28)
  },
  lose(): void {
    tone(330, 0.25, 'triangle', 0.22)
    tone(262, 0.25, 'triangle', 0.22, undefined, 0.22)
    tone(196, 0.5, 'triangle', 0.22, undefined, 0.44)
  },
}
