import zlib from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'public'
mkdirSync(OUT, { recursive: true })

const BRAND = [255, 65, 3]
const WHITE = [255, 255, 255]

function inRoundRect(px, py, x, y, w, h, r) {
  const dx = Math.min(px - x, x + w - px)
  const dy = Math.min(py - y, y + h - py)
  if (dx < 0 || dy < 0) return false
  if (dx >= r || dy >= r) return true
  const cx = dx - r
  const cy = dy - r
  return cx * cx + cy * cy <= r * r
}

function shade(x, y, S) {
  const cx = S / 2
  if (inRoundRect(x, y, cx - 0.23 * S, 0.5 * S, 0.46 * S, 0.4 * S, 0.12 * S)) {
    const dx = x - cx
    const dy = y - 0.66 * S
    if (dx * dx + dy * dy < (0.05 * S) ** 2) return BRAND
    const sd = ((x - cx) / (0.012 * S)) ** 2 + ((y - 0.74 * S) / (0.05 * S)) ** 2
    if (sd < 1) return BRAND
    return WHITE
  }
  const dx = x - cx
  const dy = y - 0.44 * S
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 0.16 * S && d > 0.1 * S && dy <= 0) return WHITE
  return BRAND
}

function render(S) {
  const SS = 4
  const px = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, S)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = SS * SS
      const i = (y * S + x) * 4
      px[i] = Math.round(r / n)
      px[i + 1] = Math.round(g / n)
      px[i + 2] = Math.round(b / n)
      px[i + 3] = 255
    }
  }
  return px
}

function crc(buf) {
  const c = zlib.crc32(buf) >>> 0
  const out = Buffer.alloc(4)
  out.writeUInt32BE(c, 0)
  return out
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const body = Buffer.concat([t, data])
  return Buffer.concat([len, body, crc(body)])
}

function encodePNG(S, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((S * 4 + 1) * S)
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0
    pixels.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  writeFileSync(`${OUT}/icon-${size}.png`, encodePNG(size, render(size)))
}
writeFileSync(`${OUT}/apple-touch-icon.png`, encodePNG(180, render(180)))
writeFileSync(`${OUT}/favicon.png`, encodePNG(64, render(64)))
console.log('icons generated')
