// One-shot: rotate the landscape OCBC application form into portrait.
// Each landscape page (842 × 595pt) is embedded as a form XObject, rotated 90° CW,
// and placed onto a fresh portrait A4 page (595 × 842pt). No scaling — dimensions
// match exactly because rotation swaps them. Output is a normal PDF whose native
// coordinate space is portrait A4, bottom-left origin — exactly what pdf-lib
// expects when we later draw text overlays onto it.
//
// Run:  node scripts/rotate-ocbc-to-portrait.mjs

import { PDFDocument, degrees } from 'pdf-lib'
import fs from 'node:fs/promises'
import path from 'node:path'

const IN  = path.resolve('Forms/OCBC APPLICATION FORM 0225.pdf')
const OUT = path.resolve('Forms/OCBC APPLICATION FORM 0225 (portrait).pdf')

const PORTRAIT_W = 595.28 // A4 width  in pt
const PORTRAIT_H = 841.89 // A4 height in pt

const srcBytes = await fs.readFile(IN)
const src = await PDFDocument.load(srcBytes)
const out = await PDFDocument.create()

const pageCount = src.getPageCount()
console.log(`Rotating ${pageCount} page(s) from ${path.basename(IN)} …`)

// Embed every source page as a form XObject so we can place + rotate it.
const embedded = await out.embedPdf(src, src.getPageIndices())

for (let i = 0; i < pageCount; i++) {
  const srcPage = src.getPage(i)
  const { width: sw, height: sh } = srcPage.getSize()
  const ep = embedded[i]

  const portrait = out.addPage([PORTRAIT_W, PORTRAIT_H])

  // Rotate the landscape page 90° clockwise and anchor so it fills the portrait.
  // Rotation in pdf-lib is around the origin; for 90° CW we translate by (0, sw)
  // so the rotated content lands with its top at y=sh (= portrait top).
  // landscape(0,0) -> portrait(0, sw)    [top-left of portrait]
  // landscape(sw,0) -> portrait(0, 0)    [bottom-left of portrait]
  // landscape(0,sh) -> portrait(sh, sw)  [top-right of portrait]
  //
  // For a landscape A4 (sw=842, sh=595) this fills the portrait A4 (595 × 842) exactly.
  portrait.drawPage(ep, {
    x: 0,
    y: sw,               // shift up by landscape width so rotation lands inside the page
    width: sw,           // draw at source size (no scale) — rotation swaps to fit portrait
    height: sh,
    rotate: degrees(-90) // -90 = 90° clockwise in pdf-lib's convention
  })
}

const bytes = await out.save()
await fs.writeFile(OUT, bytes)

console.log(`✓ Wrote ${OUT}`)
console.log(`  Every page is now ${PORTRAIT_W} × ${PORTRAIT_H}pt (A4 portrait).`)
console.log(`  Coord space: x∈[0,${PORTRAIT_W}], y∈[0,${PORTRAIT_H}], origin bottom-left.`)
