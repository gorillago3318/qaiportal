// Render any PDF to PNGs (one per page) so Claude can read them via the Read tool.
// Usage: node scripts/render-pdf-preview.mjs <input.pdf> [out-dir]
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { createCanvas } from '@napi-rs/canvas'

const require = createRequire(import.meta.url)
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs')

const IN  = process.argv[2]
const OUT = process.argv[3] || path.join(path.dirname(IN), path.basename(IN, '.pdf') + '_pages')
if (!IN) { console.error('Usage: node scripts/render-pdf-preview.mjs <input.pdf> [out-dir]'); process.exit(1) }

const DPI = 110
const SCALE = DPI / 72
const cmapUrl = pathToFileURL(path.resolve('node_modules/pdfjs-dist/cmaps') + path.sep).href
const fontUrl = pathToFileURL(path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep).href

await fs.mkdir(OUT, { recursive: true })
const data = new Uint8Array(await fs.readFile(IN))
const doc = await pdfjs.getDocument({ data, cMapUrl: cmapUrl, cMapPacked: true, standardFontDataUrl: fontUrl, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise
console.log(`${doc.numPages} pages, writing to ${OUT}`)

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p)
  const viewport = page.getViewport({ scale: SCALE })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, viewport.width, viewport.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const out = path.join(OUT, `page-${String(p).padStart(2, '0')}.png`)
  await fs.writeFile(out, canvas.toBuffer('image/png'))
  console.log('  ', out)
}
