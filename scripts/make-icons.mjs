import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const sstep = (edge, width, v) => clamp((edge + width - v) / width, 0, 1)

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const discR = size * 0.4
  const goldR = size * 0.475
  const goldW = size * 0.035
  const whiteR = size * 0.435
  const whiteW = size * 0.02
  const hx = size * 0.36
  const hy = size * 0.34

  const droplets = [
    { x: size * 0.63, y: size * 0.3, r: size * 0.075 },
    { x: size * 0.73, y: size * 0.19, r: size * 0.028 },
    { x: size * 0.545, y: size * 0.185, r: size * 0.02 },
    { x: size * 0.685, y: size * 0.395, r: size * 0.016 },
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const t = y / (size - 1)
      const dx = (x - cx) / cx
      const dy = (y - cy) / cy
      const vig = 1 - Math.min(1, dx * dx + dy * dy) * 0.4

      let r = lerp(0x1b, 0x0d, t) * vig
      let g = lerp(0x23, 0x12, t) * vig
      let b = lerp(0x34, 0x20, t) * vig

      const blend = (sr, sg, sb, sa) => {
        r = sr * sa + r * (1 - sa)
        g = sg * sa + g * (1 - sa)
        b = sb * sa + b * (1 - sa)
      }

      const d = Math.hypot(x - cx, y - cy)

      blend(0xff, 0xd8, 0x6b, sstep(goldW / 2, 2, Math.abs(d - goldR)))
      blend(0xff, 0xff, 0xff, sstep(whiteW, 1.5, Math.abs(d - whiteR)))

      if (d < discR) {
        const u = d / discR
        const hl = Math.hypot(x - hx, y - hy) / (size * 0.62)
        const hlF = (1 - clamp(hl, 0, 1)) * 0.35
        let dr = lerp(0xff, 0xcc, u)
        let dg = lerp(0xd8, 0x5d, u)
        let db = lerp(0x6b, 0x3f, u)
        dr = lerp(dr, 0xff, hlF)
        dg = lerp(dg, 0xe0, hlF * 0.85)
        db = lerp(db, 0x8a, hlF * 0.7)
        blend(dr, dg, db, 1)
      }

      for (const drop of droplets) {
        const dd = Math.hypot(x - drop.x, y - drop.y)
        blend(0xff, 0xff, 0xff, sstep(drop.r, 1.5, dd) * 0.95)
      }

      buf[i] = Math.round(r)
      buf[i + 1] = Math.round(g)
      buf[i + 2] = Math.round(b)
      buf[i + 3] = 255
    }
  }
  return buf
}

for (const size of [192, 512]) {
  const png = encodePNG(size, makeIcon(size))
  const out = resolve(outDir, `icon-${size}.png`)
  writeFileSync(out, png)
  console.log(`wrote ${out} (${png.length} bytes)`)
}
