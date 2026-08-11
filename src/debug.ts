export interface DebugInfo {
  mode: string
  phase: string
  fps: number
  camX: number
  camY: number
  camScale: number
  viewW: number
  viewH: number
  dpr: number
  arenaW: number
  arenaH: number
  hw: number
  hh: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  viewWider: boolean
  viewTaller: boolean
  playerX: number
  playerY: number
  targetX: number
  targetY: number
  wallLeft: number
  wallRight: number
  wallTop: number
  wallBottom: number
  flips: number
  maxDelta: number
}

export function isDebug(): boolean {
  return new URLSearchParams(location.search).has('debug')
}

export class DebugOverlay {
  private el: HTMLDivElement
  private lastUpdate = 0
  private frames = 0
  private time = 0

  constructor() {
    this.el = document.createElement('div')
    this.el.id = 'debug-overlay'
    document.getElementById('app')?.appendChild(this.el)
    this.el.textContent = 'debug'
  }

  update(info: DebugInfo): void {
    this.frames++
    this.time += 1 / 120
    if (this.time - this.lastUpdate < 0.12) return
    this.lastUpdate = this.time

    const fmt = (v: number): string => v.toFixed(1)
    const wall = (v: number): string => (v >= 0 && v <= info.viewW ? 'IN VIEW' : 'off')
    const lines = [
      `${info.mode} ${info.phase} | ${info.fps.toFixed(0)} fps | dpr ${info.dpr}`,
      `view ${info.viewW}x${info.viewH} | arena ${info.arenaW}x${info.arenaH}`,
      `scale ${info.camScale.toFixed(3)} | hw ${fmt(info.hw)} hh ${fmt(info.hh)}`,
      `clampX [${fmt(info.minX)}, ${fmt(info.maxX)}]${info.viewWider ? ' INVERTED' : ''}`,
      `clampY [${fmt(info.minY)}, ${fmt(info.maxY)}]${info.viewTaller ? ' INVERTED' : ''}`,
      `cam ${fmt(info.camX)}, ${fmt(info.camY)} | target ${fmt(info.targetX)}, ${fmt(info.targetY)}`,
      `player ${fmt(info.playerX)}, ${fmt(info.playerY)}`,
      `left wall screen x ${fmt(info.wallLeft)} (${wall(info.wallLeft)})`,
      `right wall screen x ${fmt(info.wallRight)} (${wall(info.wallRight)})`,
      `top wall screen y ${fmt(info.wallTop)} | bottom ${fmt(info.wallBottom)}`,
      `cam flips: ${info.flips} | max step Δx ${fmt(info.maxDelta)}`,
    ]
    this.el.textContent = lines.join('\n')
  }
}
