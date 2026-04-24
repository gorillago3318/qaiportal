// Renders portrait OCBC PDF → canvas PNG (via pdfjs-dist + @napi-rs/canvas)
// then OCRs each page with Tesseract. Writes word+bbox anchors in PDF-point
// coordinates (bottom-left origin, 595×842 for A4 portrait) to
// src/config/bank-forms/ocbc-anchors.json.
//
// Run:  node scripts/ocbc-ocr-anchors.mjs

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { createCanvas } from '@napi-rs/canvas'
import { createWorker } from 'tesseract.js'

const require = createRequire(import.meta.url)
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs')

const IN  = path.resolve('Forms/OCBC APPLICATION FORM 0225 (portrait).pdf')
const OUT = path.resolve('src/config/bank-forms/ocbc-anchors.json')
const DPI = 200
const SCALE = DPI / 72

// pdfjs needs a URL with trailing slash; pathToFileURL handles Windows correctly
const cmapUrl = pathToFileURL(path.resolve('node_modules/pdfjs-dist/cmaps') + path.sep).href
const fontUrl = pathToFileURL(path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep).href

console.log(`Rasterizing ${path.basename(IN)} @ ${DPI} DPI…`)
const pdfBytes = new Uint8Array(await fs.readFile(IN))
const doc = await pdfjs.getDocument({
  data: pdfBytes,
  cMapUrl: cmapUrl,
  cMapPacked: true,
  standardFontDataUrl: fontUrl,
  useSystemFonts: false,
  disableFontFace: true,
  verbosity: 0,
}).promise
console.log(`  loaded ${doc.numPages} page(s)`)

console.log('Loading Tesseract (eng)…')
const worker = await createWorker('eng')

const pages = []
for (let p = 1; p <= doc.numPages; p++) {
  process.stdout.write(`  page ${p}/${doc.numPages}: render… `)
  const page = await doc.getPage(p)
  const viewport = page.getViewport({ scale: SCALE })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, viewport.width, viewport.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const png = canvas.toBuffer('image/png')

  process.stdout.write('ocr… ')
  // tesseract.js v5: need to explicitly request words in the output map
  const { data } = await worker.recognize(
    png,
    {},
    { text: true, blocks: true, hocr: false, tsv: false }
  )

  // Tesseract returns word bboxes in image pixels (origin top-left).
  // Convert to PDF points with bottom-left origin:
  //   x_pt = px / SCALE
  //   y_pt = (imgHeight - py_bottom) / SCALE
  // In tesseract.js v5, words live under data.blocks[].paragraphs[].lines[].words[]
  // rather than data.words. Flatten whatever shape we got.
  const allWords = []
  if (Array.isArray(data.words) && data.words.length > 0) {
    allWords.push(...data.words)
  } else if (Array.isArray(data.blocks)) {
    for (const b of data.blocks) {
      for (const par of (b.paragraphs || [])) {
        for (const ln of (par.lines || [])) {
          for (const w of (ln.words || [])) allWords.push(w)
        }
      }
    }
  }

  const pageHeightPx = viewport.height
  const words = allWords
    .filter((w) => w.text && w.text.trim() !== '')
    .map((w) => {
      const x_pt = w.bbox.x0 / SCALE
      const w_pt = (w.bbox.x1 - w.bbox.x0) / SCALE
      const h_pt = (w.bbox.y1 - w.bbox.y0) / SCALE
      const y_pt = (pageHeightPx - w.bbox.y1) / SCALE
      return {
        text: w.text,
        x: +x_pt.toFixed(2),
        y: +y_pt.toFixed(2),
        w: +w_pt.toFixed(2),
        h: +h_pt.toFixed(2),
        conf: +w.confidence.toFixed(1),
      }
    })
    .filter((w) => w.conf >= 30)

  pages.push({
    page: p - 1,
    width:  +(viewport.width / SCALE).toFixed(2),
    height: +(viewport.height / SCALE).toFixed(2),
    items: words,
  })
  console.log(`${words.length} words`)
}

await worker.terminate()

await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, JSON.stringify({
  source: path.basename(IN),
  method: `tesseract@${DPI}dpi`,
  generated: new Date().toISOString(),
  pages,
}, null, 2))

const total = pages.reduce((s, p) => s + p.items.length, 0)
console.log(`✓ Wrote ${OUT}`)
console.log(`  ${total} words across ${pages.length} page(s)`)
