import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

// ─── OCBC anchor lookup (OCR-derived, one-time) ──────────────────────────────
// Anchors live in src/config/bank-forms/ocbc-anchors.json — produced by
// scripts/ocbc-ocr-anchors.mjs. Each word on each page has (x, y, w, h) in PDF
// points (bottom-left origin, A4 portrait). Re-run the script if the template
// ever changes.
// Loaded at runtime via fs (not bundled import) because the JSON is ~2MB and
// the bundler can silently fail to include it, which would cause overlay to
// no-op and fall through to the clean PDF.
interface OCBCAnchor { text: string; x: number; y: number; w: number; h: number; conf: number }
interface OCBCPage { page: number; width: number; height: number; items: OCBCAnchor[] }
let _ocbcAnchors: { pages: OCBCPage[] } | null = null
function loadOcbcAnchors(): { pages: OCBCPage[] } {
  if (_ocbcAnchors) return _ocbcAnchors
  const jsonPath = path.join(process.cwd(), 'src', 'config', 'bank-forms', 'ocbc-anchors.json')
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`OCBC anchors JSON not found at ${jsonPath}`)
  }
  _ocbcAnchors = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  return _ocbcAnchors!
}

/**
 * Find an anchor word on a given page. Matching is case-insensitive substring.
 * opts.nth picks the Nth match (0-based, default 0 = first).
 * opts.yNear restricts to items whose y is within ±range of the given value
 * (useful when the same label appears in a header and in a field row).
 * Returns `null` if no match so callers can fall back gracefully.
 */
function findAnchor(
  page: number,
  text: string,
  opts: {
    nth?: number
    yNear?: { y: number; range: number }
    xLt?: number
    xGt?: number
  } = {}
): OCBCAnchor | null {
  const pg = loadOcbcAnchors().pages[page]
  if (!pg) return null
  const needle = text.toLowerCase()
  let matches = pg.items.filter((it) => it.text.toLowerCase().includes(needle))
  if (opts.yNear) {
    const { y, range } = opts.yNear
    matches = matches.filter((it) => Math.abs(it.y - y) <= range)
  }
  if (typeof opts.xLt === 'number') matches = matches.filter((it) => it.x < opts.xLt!)
  if (typeof opts.xGt === 'number') matches = matches.filter((it) => it.x > opts.xGt!)
  return matches[opts.nth ?? 0] ?? null
}

/**
 * Place a tick at an absolute (x, y) coordinate on a page — used when OCR
 * didn't capture a checkbox anchor (common in the Applicant 1 column for
 * Mr/Mrs/Miss rows) and we need to force a known column position.
 */

// ─── HLB Form Field Positions ─────────────────────────────────────────────────
// A4 = 595 x 842 pts.  y=0 at BOTTOM of page.  Page index is 0-based.
// Calibrated against HONG LEONG BANK APPLICATION FORM.pdf
const HLB_FIELDS: Record<string, { page: number; x: number; y: number; maxWidth?: number }> = {
  // ── PAGE 0 ─ Section A: Loan/Financing Requirement ───────────────────────
  // Purpose of Financing checkboxes (y≈600–615 band)
  purpose_purchase_own:        { page: 0, x: 285, y: 614 },
  purpose_purchase_business:   { page: 0, x: 285, y: 598 },
  purpose_purchase_investment: { page: 0, x: 285, y: 582 },
  purpose_refinance:           { page: 0, x: 285, y: 566 },
  purpose_renovation:          { page: 0, x: 285, y: 550 },
  purpose_solar:               { page: 0, x: 285, y: 534 },
  // Facility Details row (y≈511)
  facility_amount:             { page: 0, x: 335, y: 511 },
  facility_tenure_months:      { page: 0, x: 468, y: 511 },
  // Finance costs (y≈440–418)
  finance_legal_cost_yes_rm:   { page: 0, x: 335, y: 440 },
  finance_val_cost_yes_rm:     { page: 0, x: 335, y: 418 },
  // Refinance current bank (y≈391)
  current_bank_name:           { page: 0, x: 175, y: 391 },
  // Refinance purposes (y≈363–318)
  refinance_interest_saving:   { page: 0, x: 285, y: 363 },
  refinance_working_capital:   { page: 0, x: 285, y: 348 },
  refinance_renovation:        { page: 0, x: 285, y: 318 },
  // Insurance (y≈258–154)
  insurance_financed_by:       { page: 0, x: 335, y: 258 },
  insurance_type:              { page: 0, x: 285, y: 243 },
  insurance_premium_amount:    { page: 0, x: 175, y: 226 },
  insurance_term_months:       { page: 0, x: 335, y: 209 },
  deferment_period_months:     { page: 0, x: 335, y: 192 },
  sum_insured_main:            { page: 0, x: 175, y: 173 },
  sum_insured_joint:           { page: 0, x: 175, y: 154 },
  // ── PAGE 1 ─ Section B: Property Details ─────────────────────────────────
  // Financing type checkboxes (y≈620–592)
  financing_type_developer:    { page: 1, x: 285, y: 620 },
  financing_type_subsale:      { page: 1, x: 285, y: 606 },
  financing_type_refinance:    { page: 1, x: 285, y: 592 },
  // Property info rows (y≈540–380)
  developer_seller_name:       { page: 1, x: 175, y: 540 },
  project_name:                { page: 1, x: 175, y: 519 },
  property_address:            { page: 1, x: 175, y: 495, maxWidth: 280 },
  property_city:               { page: 1, x: 175, y: 473 },
  property_post_code:          { page: 1, x: 415, y: 473 },
  property_state:              { page: 1, x: 175, y: 458 },
  property_country:            { page: 1, x: 415, y: 458 },
  purchase_price:              { page: 1, x: 175, y: 446 },
  land_size_sqft:              { page: 1, x: 175, y: 401 },
  buildup_size_sqft:           { page: 1, x: 175, y: 381 },
  // Title & tenure (y≈271 and y≈127)
  title_type:                  { page: 1, x: 285, y: 271 },
  land_tenure:                 { page: 1, x: 285, y: 127 },
  // ── PAGE 2 ─ Section E Part A: Principal Applicant ───────────────────────
  // Identity block (y≈769–700)
  client_title:                { page: 2, x: 285, y: 769 },
  client_name:                 { page: 2, x: 175, y: 760, maxWidth: 280 },
  client_ic:                   { page: 2, x: 175, y: 737 },
  client_old_ic:               { page: 2, x: 175, y: 721 },
  client_passport:             { page: 2, x: 175, y: 700 },
  // Personal details — below Residency table (y≈518–350)
  client_dob:                  { page: 2, x: 285, y: 518 },
  bumiputra:                   { page: 2, x: 285, y: 503 },
  gender:                      { page: 2, x: 285, y: 488 },
  race:                        { page: 2, x: 175, y: 471 },
  marital_status:              { page: 2, x: 175, y: 454 },
  no_of_dependants:            { page: 2, x: 175, y: 432 },
  home_address:                { page: 2, x: 175, y: 416, maxWidth: 275 },
  city:                        { page: 2, x: 175, y: 400 },
  post_code:                   { page: 2, x: 415, y: 400 },
  state:                       { page: 2, x: 175, y: 387 },
  country:                     { page: 2, x: 415, y: 387 },
  years_at_address:            { page: 2, x: 175, y: 372 },
  correspondence_address:      { page: 2, x: 175, y: 350, maxWidth: 275 },
  // Contact (y≈261 and y≈185)
  client_phone:                { page: 2, x: 370, y: 261 },
  client_email:                { page: 2, x: 175, y: 185 },
  // ── PAGE 3 ─ Section E Part B: Employment Details ────────────────────────
  employment_type:             { page: 3, x: 285, y: 768 },
  employer_name:               { page: 3, x: 175, y: 746 },
  nature_of_business:          { page: 3, x: 175, y: 726 },
  occupation:                  { page: 3, x: 175, y: 706 },
  employer_address:            { page: 3, x: 175, y: 680, maxWidth: 275 },
  office_tel:                  { page: 3, x: 175, y: 638 },
  length_service_years:        { page: 3, x: 175, y: 618 },
  length_service_months:       { page: 3, x: 415, y: 618 },
  monthly_income:              { page: 3, x: 175, y: 597 },
  company_establishment_date:  { page: 3, x: 285, y: 575 },
}

// OCBC field positions are no longer hard-coded — `overlayOCBC` derives them
// at runtime from OCR-extracted anchor words in ocbc-anchors.json. See
// `findAnchor()` above and `drawAt()` inside `overlayOCBC`.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  if (s.includes('/')) return s
  if (s.includes('-') && s.length === 10) {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  return s
}

function fmtCurrency(v: number | string | null | undefined | unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  if (!isFinite(n) || n === 0) return ''
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Clean PDF Generator (always works, no template needed) ─────────────────

async function generateCleanPdf(data: Record<string, unknown>, isHLB: boolean): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const bankLabel = isHLB ? 'HONG LEONG BANK BERHAD' : 'OCBC BANK (MALAYSIA) BERHAD'
  const W = 595, H = 842, M = 50, colW = W - M * 2
  let page = pdfDoc.addPage([W, H])
  let y = H - M

  const nl = (gap = 14) => { y -= gap }
  const ensure = (n = 40) => {
    if (y < M + n) { page = pdfDoc.addPage([W, H]); y = H - M }
  }
  const heading = (text: string) => {
    ensure(30)
    page.drawText(text, { x: M, y, size: 11, font: helveticaBold, color: rgb(0, 0.18, 0.4) })
    nl(13)
    page.drawLine({ start: { x: M, y }, end: { x: M + colW, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
    nl(10)
  }
  const field = (label: string, value: string | null | undefined) => {
    if (!value && value !== '0') return
    ensure(16)
    page.drawText(`${label}:`, { x: M, y, size: 8, font: helveticaBold, color: rgb(0.35, 0.35, 0.35) })
    page.drawText(String(value), { x: M + 185, y, size: 9, font: helvetica, color: rgb(0, 0, 0), maxWidth: colW - 185 })
    nl(15)
  }

  // Title block
  page.drawText('PROPERTY LOAN APPLICATION FORM', { x: M, y, size: 15, font: helveticaBold, color: rgb(0, 0.18, 0.4) }); nl(19)
  page.drawText(bankLabel, { x: M, y, size: 11, font: helveticaBold, color: rgb(0.79, 0.66, 0.30) }); nl(13)
  page.drawText(
    `Case: ${(data.case_code as string) || 'DRAFT'}   Date: ${fmtDate(new Date().toISOString().split('T')[0])}   Status: ${(data.status as string) || 'Draft'}`,
    { x: M, y, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) }
  ); nl(22)

  heading('SECTION A — PERSONAL DETAILS')
  field('Title', (data.client_title as string)?.toUpperCase())
  field('Full Name', data.client_name as string)
  field('NRIC No', data.client_ic as string)
  field('Old IC No', data.client_old_ic as string)
  field('Passport No', data.client_passport as string)
  field('Date of Birth', fmtDate(data.client_dob as string))
  field('Gender', (data.gender as string) === 'male' ? 'Male' : (data.gender as string) === 'female' ? 'Female' : data.gender as string)
  field('Race', data.race as string)
  field('Bumiputra', data.bumiputra === true || data.bumiputra === 'yes' ? 'Yes' : data.bumiputra === false || data.bumiputra === 'no' ? 'No' : undefined)
  field('Marital Status', (data.marital_status as string)?.replace(/_/g, ' '))
  field('No. of Dependants', data.no_of_dependants?.toString())
  field('Home Address', data.home_address as string)
  field('City', data.city as string)
  field('Postcode', data.post_code as string)
  field('State', data.state as string)
  field('Country', (data.country as string) || 'Malaysia')
  field('Years at Address', data.years_at_address?.toString())
  field('Correspondence Address', data.correspondence_same_as_home ? 'Same as home address' : data.correspondence_address as string)
  field('Contact No (Mobile)', data.client_phone as string)
  field('Email', data.client_email as string)
  nl(6)

  heading('SECTION B — EMPLOYMENT DETAILS')
  field('Employment Type', (data.employment_type as string)?.replace(/_/g, ' '))
  field('Employer / Company', data.employer_name as string)
  field('Nature of Business', data.nature_of_business as string)
  field('Occupation / Position', data.occupation as string)
  field('Office Address', data.employer_address as string)
  field('Office Tel', data.office_tel as string)
  field('Length of Service', `${data.length_service_years || 0} year(s)  ${data.length_service_months || 0} month(s)`)
  field('Monthly Gross Income', fmtCurrency(data.monthly_income))
  field('Company Est. Date', fmtDate(data.company_establishment_date as string))
  nl(6)

  heading('SECTION C — FINANCING DETAILS')
  field('Product Type', (data.product_type as string)?.replace(/_/g, ' '))
  field('Purpose of Financing', Array.isArray(data.purpose_of_financing)
    ? (data.purpose_of_financing as string[]).join(', ')
    : (data.purpose_of_financing as string)?.replace(/_/g, ' '))
  field('Financing Amount (RM)', fmtCurrency(data.facility_amount || data.loan_amount || data.proposed_loan_amount))
  field('Tenure', data.facility_tenure_months ? `${data.facility_tenure_months} months` : data.tenure_years ? `${data.tenure_years} years` : data.loan_tenure ? `${data.loan_tenure} years` : undefined)
  field('Interest / Profit Rate', data.interest_rate ? `${data.interest_rate}% p.a.` : undefined)
  field('Finance Legal Cost', (data.finance_legal_cost === true || data.finance_legal_cost === 'yes') ? `Yes — RM ${fmtCurrency(data.legal_cost_amount)}` : 'No')
  field('Finance Valuation Cost', (data.finance_valuation_cost === true || data.finance_valuation_cost === 'yes') ? `Yes — RM ${fmtCurrency(data.valuation_cost_amount)}` : 'No')
  if (data.current_bank_name) field('Current Bank (Refinance)', data.current_bank_name as string)
  if (Array.isArray(data.refinance_purpose) && (data.refinance_purpose as string[]).length > 0) {
    field('Purpose of Refinancing', (data.refinance_purpose as string[]).join(', '))
  }
  nl(6)

  heading('SECTION D — PROPERTY DETAILS')
  field('Financing Type', (data.loan_type as string)?.replace(/_/g, ' '))
  field('Property Type', (data.property_type as string)?.replace(/_/g, ' '))
  if (data.developer_seller_name) field('Developer / Seller', data.developer_seller_name as string)
  if (data.project_name) field('Project Name', data.project_name as string)
  field('Property Address', data.property_address as string)
  field('City', data.property_city as string)
  field('Postcode', data.property_post_code as string)
  field('State', data.property_state as string)
  field('Purchase Price (RM)', fmtCurrency(data.purchase_price))
  field('Land Size (sqft)', data.land_size_sqft?.toString())
  field('Built-Up Size (sqft)', data.buildup_size_sqft?.toString())
  field('Title Type', (data.title_type as string)?.replace(/_/g, ' '))
  field('Land Tenure', (data.land_tenure as string)?.replace(/_/g, ' '))
  nl(6)

  // Co-borrowers
  const coBorrs = data.co_borrowers as Array<Record<string, unknown>> | undefined
  if (Array.isArray(coBorrs) && coBorrs.length > 0) {
    heading('SECTION E — CO-BORROWER(S)')
    coBorrs.forEach((cb, i) => {
      field(`Co-Borrower ${i + 1} Name`, cb.full_name as string)
      field(`Co-Borrower ${i + 1} NRIC`, cb.ic_number as string)
      field(`Co-Borrower ${i + 1} DOB`, fmtDate(cb.date_of_birth as string))
      field(`Co-Borrower ${i + 1} Relationship`, cb.relationship as string)
      nl(4)
    })
  }

  heading('SECTION F — LAWYER & VALUER')
  if (data.selected_lawyer_type === 'panel') {
    field('Lawyer Type', 'Panel Lawyer')
    field('Professional Fee (RM)', fmtCurrency(data.lawyer_professional_fee))
  } else if (data.lawyer_name_other) {
    field('Lawyer Type', 'Own Lawyer')
    field('Lawyer Name', data.lawyer_name_other as string)
    field('Lawyer Firm', data.lawyer_firm_other as string)
    field('Lawyer Contact', data.lawyer_contact_other as string)
  }
  field('Valuer 1 Firm', (data.valuer_1_firm || data.valuer_name) as string)
  field('Valuer 1 Name', data.valuer_1_name as string)
  field('Valuer 1 Date', fmtDate((data.valuer_1_date || data.valuation_date) as string))
  field('Valuer 1 Indicative Value (RM)', fmtCurrency(data.valuer_1_amount || data.indicative_value))
  field('Valuer 2 Firm', data.valuer_2_firm as string)
  field('Valuer 2 Name', data.valuer_2_name as string)
  field('Valuer 2 Date', fmtDate(data.valuer_2_date as string))
  field('Valuer 2 Indicative Value (RM)', fmtCurrency(data.valuer_2_amount))
  nl(6)

  // Footer on last page
  const lastPg = pdfDoc.getPages()[pdfDoc.getPageCount() - 1]
  lastPg.drawText(
    `Generated by QuantifyAI Portal  ·  Case: ${(data.case_code as string) || 'DRAFT'}  ·  ${new Date().toLocaleDateString('en-MY')}`,
    { x: M, y: M - 15, size: 7, font: helvetica, color: rgb(0.6, 0.6, 0.6) }
  )

  return pdfDoc.save()
}

// ─── Template Overlay (HLB) ──────────────────────────────────────────────────

async function overlayHLB(
  templateBytes: Uint8Array,
  data: Record<string, unknown>
): Promise<Uint8Array> {
  // ignoreEncryption lets us load even password-protected PDFs (we only overlay, no re-encrypt)
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pages = pdfDoc.getPages()

  const draw = (key: string, text: string | null | undefined, opts: { bold?: boolean; size?: number } = {}) => {
    if (!text) return
    const pos = HLB_FIELDS[key]
    if (!pos) return
    const pg = pages[pos.page]
    if (!pg) return
    const o: Parameters<typeof pg.drawText>[1] = {
      x: pos.x, y: pos.y,
      size: opts.size ?? 9,
      font: opts.bold ? helveticaBold : helvetica,
      color: rgb(0, 0, 0),
    }
    if (pos.maxWidth) o.maxWidth = pos.maxWidth
    pg.drawText(text, o)
  }
  const tick = (key: string) => draw(key, 'X', { bold: true, size: 11 })

  // Page 0 — Section A
  const purpose = data.purpose_of_financing as string | string[] || ''
  const purposes = Array.isArray(purpose) ? purpose : [purpose]
  if (purposes.includes('purchase_own'))        tick('purpose_purchase_own')
  if (purposes.includes('purchase_business'))   tick('purpose_purchase_business')
  if (purposes.includes('purchase_investment')) tick('purpose_purchase_investment')
  if (purposes.includes('refinance'))           tick('purpose_refinance')
  if (purposes.includes('renovation'))          tick('purpose_renovation')
  if (purposes.includes('solar_panel'))         tick('purpose_solar')

  const loanAmt = data.facility_amount || data.loan_amount || data.proposed_loan_amount
  draw('facility_amount', fmtCurrency(loanAmt), { bold: true })
  const tenure = data.facility_tenure_months || (data.tenure_years ? Number(data.tenure_years) * 12 : null) || data.loan_tenure
  if (tenure) draw('facility_tenure_months', tenure.toString())

  if (data.finance_legal_cost === true || data.finance_legal_cost === 'yes')
    draw('finance_legal_cost_yes_rm', fmtCurrency(data.legal_cost_amount))
  if (data.finance_valuation_cost === true || data.finance_valuation_cost === 'yes')
    draw('finance_val_cost_yes_rm', fmtCurrency(data.valuation_cost_amount))

  draw('current_bank_name', data.current_bank_name as string)

  const refinancePurposes = Array.isArray(data.refinance_purpose)
    ? data.refinance_purpose as string[]
    : [data.refinance_purpose as string]
  if (refinancePurposes.includes('interest_saving')) tick('refinance_interest_saving')
  if (refinancePurposes.includes('working_capital'))  tick('refinance_working_capital')
  if (refinancePurposes.includes('renovation'))       tick('refinance_renovation')

  const ins = data.insurance_type as string
  if (ins && ins !== 'none') {
    draw('insurance_financed_by', String(data.insurance_financed_by || '').toUpperCase())
    draw('insurance_type', ins.toUpperCase())
    draw('insurance_premium_amount', fmtCurrency(data.insurance_premium_amount))
    if (data.insurance_term_months) draw('insurance_term_months', data.insurance_term_months.toString())
    if (data.deferment_period_months) draw('deferment_period_months', data.deferment_period_months.toString())
    draw('sum_insured_main', fmtCurrency(data.sum_insured_main))
    draw('sum_insured_joint', fmtCurrency(data.sum_insured_joint))
  }

  // Page 1 — Section B
  const lt = data.loan_type as string
  if (lt === 'developer') tick('financing_type_developer')
  if (lt === 'subsale')   tick('financing_type_subsale')
  if (lt === 'refinance') tick('financing_type_refinance')

  draw('developer_seller_name', data.developer_seller_name as string)
  draw('project_name', data.project_name as string)
  draw('property_address', data.property_address as string, { size: 8 })
  draw('property_city', data.property_city as string)
  draw('property_post_code', data.property_post_code as string)
  draw('property_state', data.property_state as string)
  draw('property_country', (data.property_country as string) || 'Malaysia')
  draw('purchase_price', fmtCurrency(data.purchase_price), { bold: true })
  draw('land_size_sqft', data.land_size_sqft?.toString())
  draw('buildup_size_sqft', data.buildup_size_sqft?.toString())
  draw('title_type', data.title_type as string)
  draw('land_tenure', data.land_tenure as string)

  // Page 2 — Section E Part A
  const titleMap: Record<string, string> = { mr: 'Mr', ms: 'Ms', mrs: 'Mrs', dr: 'Dr' }
  draw('client_title', titleMap[(data.client_title as string)?.toLowerCase()] || data.client_title as string, { bold: true })
  draw('client_name', data.client_name as string, { bold: true, size: 10 })
  draw('client_ic', data.client_ic as string)
  draw('client_old_ic', data.client_old_ic as string)
  draw('client_passport', data.client_passport as string)
  draw('client_dob', fmtDate(data.client_dob as string))
  draw('bumiputra', (data.bumiputra === true || data.bumiputra === 'yes') ? 'Yes' : 'No')
  draw('gender', (data.gender as string) === 'male' ? 'Male' : (data.gender as string) === 'female' ? 'Female' : '')
  const raceStr = data.race as string
  draw('race', raceStr ? raceStr.charAt(0).toUpperCase() + raceStr.slice(1) : '')
  const msStr = data.marital_status as string
  draw('marital_status', msStr ? msStr.charAt(0).toUpperCase() + msStr.slice(1) : '')
  draw('no_of_dependants', data.no_of_dependants?.toString() ?? '0')
  draw('home_address', data.home_address as string, { size: 8 })
  draw('city', data.city as string)
  draw('post_code', data.post_code as string)
  draw('state', data.state as string)
  draw('country', (data.country as string) || 'Malaysia')
  draw('years_at_address', data.years_at_address?.toString())
  draw('correspondence_address',
    data.correspondence_same_as_home
      ? '(Same as home address)'
      : (data.correspondence_address as string),
    { size: 8 }
  )
  draw('client_phone', data.client_phone as string)
  draw('client_email', data.client_email as string, { size: 8 })

  // Page 3 — Section E Part B
  const empMap: Record<string, string> = {
    salaried: 'Salaried', professional: 'Professional',
    self_employed: 'Self-Employed', others: 'Others',
  }
  draw('employment_type', empMap[data.employment_type as string] || data.employment_type as string || '')
  draw('employer_name', data.employer_name as string)
  draw('nature_of_business', data.nature_of_business as string)
  draw('occupation', data.occupation as string)
  draw('employer_address', data.employer_address as string, { size: 8 })
  draw('office_tel', data.office_tel as string)
  draw('length_service_years', data.length_service_years?.toString())
  draw('length_service_months', data.length_service_months?.toString())
  draw('monthly_income', fmtCurrency(data.monthly_income), { bold: true })
  draw('company_establishment_date', fmtDate(data.company_establishment_date as string))

  // Footer stamp on last page
  const lastPg = pages[pages.length - 1]
  if (lastPg) {
    lastPg.drawText(
      `QAI Case: ${(data.case_code as string) || 'DRAFT'}  |  ${new Date().toLocaleDateString('en-MY')}`,
      { x: 50, y: 20, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5) }
    )
  }

  return pdfDoc.save()
}

// ─── Template AcroForm Fill (OCBC — preferred) ──────────────────────────────
//
// The OCBC template PDF carries AcroForm fields (text boxes, checkboxes,
// radio groups) that are placed pixel-perfectly by whoever annotated the PDF
// in Acrobat / Foxit / LibreOffice Draw. We simply look up fields by name
// and set values — no coordinate guessing.
//
// Field-name convention (keep it flat & predictable):
//   • Text fields:    same id as `cases.bank_form_data` key
//                     (e.g. `home_loan_amount`, `client_name`)
//   • Checkboxes:     `<field>_<value>` for single-select groups
//                     (e.g. `product_conventional`, `purpose_purchase`)
//   • Radio groups:   named after the field id (e.g. `gender`) with
//                     export values `male`/`female`. If the editor can't
//                     make a radio group, fall back to individual
//                     `<field>_<value>` checkboxes — the fill code handles
//                     both transparently.
//
// If the template has ZERO AcroForm fields the function returns null and
// the route falls back to the legacy coordinate overlay. This lets the
// user annotate the template one page at a time and test progressively.
async function fillOCBCForm(
  templateBytes: Uint8Array,
  data: Record<string, unknown>
): Promise<Uint8Array | null> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  const fields = form.getFields()
  if (fields.length === 0) return null // no AcroForm — signal caller to fall back

  const setText = (name: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return
    try {
      const f = form.getTextField(name)
      f.setText(String(value))
    } catch { /* field doesn't exist on template yet — silently skip */ }
  }
  const setCheck = (name: string) => {
    try { form.getCheckBox(name).check() } catch { /* skip */ }
  }
  /** Single-select group: try radio group named `field`; else checkbox `field_value`. */
  const setChoice = (field: string, value: unknown) => {
    if (!value) return
    const v = String(value)
    try { form.getRadioGroup(field).select(v); return } catch { /* no radio group */ }
    try { form.getCheckBox(`${field}_${v}`).check() } catch { /* skip */ }
  }

  // ── PAGE 1 (index 0) — Financing Details / Requirement ────────────────────
  setChoice('product_type', data.product_type)
  setText('opf_currency', data.opf_currency)
  setChoice('purpose', data.purpose)
  setChoice('refinance_purpose', data.refinance_purpose)

  // Financing breakdown (amounts + tenures)
  const num = (k: string) => parseFloat((data[k] as string) || '0') || 0
  const home   = num('home_loan_amount')
  const term   = num('term_loan_amount')
  const odft   = num('overdraft_amount')
  const legal  = num('legal_fee_amount')
  const valFee = num('valuation_fee_amount')
  const stamp  = num('stamp_duty_amount')
  const takaful= num('takaful_premium_amount')
  const total  = home + term + odft + legal + valFee + stamp + takaful
  if (home   > 0) setText('home_loan_amount', fmtCurrency(home))
  if (term   > 0) setText('term_loan_amount', fmtCurrency(term))
  if (odft   > 0) setText('overdraft_amount', fmtCurrency(odft))
  if (legal  > 0) setText('legal_fee_amount', fmtCurrency(legal))
  if (valFee > 0) setText('valuation_fee_amount', fmtCurrency(valFee))
  if (stamp  > 0) setText('stamp_duty_amount', fmtCurrency(stamp))
  if (takaful> 0) setText('takaful_premium_amount', fmtCurrency(takaful))
  setText('home_loan_tenure', data.home_loan_tenure)
  setText('term_loan_tenure', data.term_loan_tenure)
  if (total > 0) setText('total_financing_amount', fmtCurrency(total))

  setChoice('instalment_rental_start', data.instalment_rental_start)
  setChoice('buyer_seller_relationship', data.buyer_seller_relationship)

  // 1.1 Refinancing details
  setText('current_bank_name', data.current_bank_name)
  setText('existing_loan_customer', data.existing_loan_customer)
  setText('outstanding_balance', fmtCurrency(data.outstanding_balance))

  // ── PAGE 2+ (future) — add section-by-section once template is annotated ─
  // Every call below is safe: `setText`/`setChoice` no-op if the field
  // isn't on the template yet. So you can ship pages progressively.
  //
  // Collateral / Property
  setText('property_owner_names', data.property_owner_names)
  setText('property_address', data.property_address)
  setText('property_postcode', data.property_postcode)
  setChoice('property_type', data.property_type)
  setText('buildup_area', data.buildup_area)
  setText('land_area', data.land_area)
  setText('purchase_price_market_value', fmtCurrency(data.purchase_price_market_value))
  setChoice('type_of_purchase', data.type_of_purchase)
  setChoice('property_usage_purpose', data.property_usage_purpose)
  setChoice('construction_stage', data.construction_stage)
  setText('age_of_property', data.age_of_property)
  setText('project_name', data.project_name)
  setText('developer_name', data.developer_name)
  setChoice('ccc_issued', data.ccc_issued)
  setChoice('title_type', data.title_type)
  setChoice('land_type', data.land_type)
  setText('leasehold_expiry_date', fmtDate(data.leasehold_expiry_date as string))
  setChoice('restriction_of_interest', data.restriction_of_interest)
  setText('restriction_details', data.restriction_details)

  // Applicant 1
  setChoice('applicant_type', data.applicant_type)
  setText('client_name', data.client_name)
  setChoice('client_title', data.client_title)
  setText('client_title_other', data.client_title_other)
  setChoice('id_type', data.id_type)
  setText('client_ic', data.client_ic)
  setText('client_old_ic', data.client_old_ic)
  setText('client_passport', data.client_passport)
  setText('passport_expiry_date', fmtDate(data.passport_expiry_date as string))
  setText('client_other_id', data.client_other_id)
  setChoice('entry_permit_type', data.entry_permit_type)
  setText('entry_permit_expiry_date', fmtDate(data.entry_permit_expiry_date as string))
  setText('client_dob', fmtDate(data.client_dob as string))
  setChoice('gender', data.gender)
  setChoice('race', data.race)
  setChoice('bumiputra', data.bumiputra)
  setChoice('education_level', data.education_level)
  setChoice('marital_status', data.marital_status)
  setText('spouse_nationality', data.spouse_nationality)

  // A1 Residence
  setText('no_of_dependants', data.no_of_dependants)
  setText('home_address', data.home_address)
  setText('post_code', data.post_code)
  setChoice('residence_type', data.residence_type)
  setText('years_at_address', data.years_at_address)
  setChoice('mailing_address_type', data.mailing_address_type)
  setText('alternate_address', data.alternate_address)
  setText('alternate_postcode', data.alternate_postcode)
  setChoice('residency_status', data.residency_status)
  setText('other_country_name', data.other_country_name)
  setText('client_phone_mobile', data.client_phone_mobile)
  setText('client_phone_home', data.client_phone_home)
  setText('client_phone_office', data.client_phone_office)
  setText('client_email', data.client_email)
  setText('emergency_contact_name', data.emergency_contact_name)
  setText('emergency_contact_relation', data.emergency_contact_relation)
  setText('emergency_contact_phone', data.emergency_contact_phone)

  // A1 Employment
  setChoice('employment_type', data.employment_type)
  setText('employer_name', data.employer_name)
  setChoice('business_entity', data.business_entity)
  setChoice('employment_status', data.employment_status)
  setText('occupation', data.occupation)
  setText('nature_of_business', data.nature_of_business)
  if (data.pep_politician)           setCheck('pep_politician')
  if (data.pep_diplomat)             setCheck('pep_diplomat')
  if (data.pep_government_officer)   setCheck('pep_government_officer')
  if (data.pep_senior_mgmt_intl_org) setCheck('pep_senior_mgmt_intl_org')
  if (data.pep_royal_family)         setCheck('pep_royal_family')
  if (data.pep_not_applicable)       setCheck('pep_not_applicable')
  setText('employer_address', data.employer_address)
  setText('office_postcode', data.office_postcode)
  setText('office_tel', data.office_tel)
  setText('length_service_years', data.length_service_years)
  setText('length_service_months', data.length_service_months)
  setText('monthly_income', fmtCurrency(data.monthly_income))
  setText('prev_employer_name', data.prev_employer_name)
  setText('prev_employer_years', data.prev_employer_years)
  setText('prev_employer_months', data.prev_employer_months)

  // Applicant 2 block
  setChoice('a2_enabled', data.a2_enabled)
  setChoice('a2_type', data.a2_type)
  setText('a2_name', data.a2_name)
  setChoice('a2_title', data.a2_title)
  setChoice('a2_id_type', data.a2_id_type)
  setText('a2_ic', data.a2_ic)
  setText('a2_old_ic', data.a2_old_ic)
  setText('a2_passport', data.a2_passport)
  setText('a2_passport_expiry', fmtDate(data.a2_passport_expiry as string))
  setText('a2_dob', fmtDate(data.a2_dob as string))
  setChoice('a2_gender', data.a2_gender)
  setChoice('a2_race', data.a2_race)
  setChoice('a2_bumiputra', data.a2_bumiputra)
  setChoice('a2_marital', data.a2_marital)
  setText('a2_home_address', data.a2_home_address)
  setText('a2_home_postcode', data.a2_home_postcode)
  setText('a2_phone_mobile', data.a2_phone_mobile)
  setText('a2_email', data.a2_email)
  setChoice('a2_employment_type', data.a2_employment_type)
  setText('a2_employer_name', data.a2_employer_name)
  setText('a2_occupation', data.a2_occupation)
  setText('a2_nature_of_business', data.a2_nature_of_business)
  setText('a2_monthly_income', fmtCurrency(data.a2_monthly_income))

  // Existing Facilities (3 slots)
  for (const i of [1, 2, 3]) {
    setText(`facility_${i}_bank`,        data[`facility_${i}_bank`])
    setText(`facility_${i}_nature`,      data[`facility_${i}_nature`])
    setText(`facility_${i}_monthly`,     fmtCurrency(data[`facility_${i}_monthly`]))
    setText(`facility_${i}_outstanding`, fmtCurrency(data[`facility_${i}_outstanding`]))
  }

  // Valuers (2 slots)
  for (const i of [1, 2]) {
    setText(`valuer_${i}_firm`,   data[`valuer_${i}_firm`])
    setText(`valuer_${i}_name`,   data[`valuer_${i}_name`])
    setText(`valuer_${i}_amount`, fmtCurrency(data[`valuer_${i}_amount`]))
    setText(`valuer_${i}_date`,   fmtDate(data[`valuer_${i}_date`] as string))
  }

  // Consent / FATCA
  if (data.consent_personal_data)       setCheck('consent_personal_data')
  if (data.consent_third_party_charges) setCheck('consent_third_party_charges')
  if (data.consent_product_disclosure)  setCheck('consent_product_disclosure')
  setChoice('fatca_us_person', data.fatca_us_person)
  setText('fatca_us_tin', data.fatca_us_tin)
  setChoice('interested_ocbc_card', data.interested_ocbc_card)

  // Flatten: burn values onto the page as static text so the downloaded PDF
  // can't be edited and doesn't show form-field outlines in viewers.
  form.flatten()

  // Footer stamp — after flatten so it's drawn fresh on the last page
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  const lastPg = pages[pages.length - 1]
  if (lastPg) {
    lastPg.drawText(
      `QAI Case: ${(data.case_code as string) || 'DRAFT'}  |  ${new Date().toLocaleDateString('en-MY')}`,
      { x: 50, y: 20, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5) }
    )
  }

  return pdfDoc.save()
}

// ─── Template Overlay (OCBC — portrait, LEGACY FALLBACK) ────────────────────

async function overlayOCBC(
  templateBytes: Uint8Array,
  data: Record<string, unknown>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pages = pdfDoc.getPages()

  /**
   * Draw text relative to a discovered anchor word.
   * dx = horizontal offset from the anchor's LEFT edge
   * dy = vertical offset from the anchor's BASELINE (negative = below)
   * The anchor defaults to the first occurrence on the given page; pass
   * `nth` to pick a later one, or `yNear` to disambiguate by row position.
   */
  const drawAt = (
    page: number,
    anchorText: string,
    value: string | null | undefined,
    opts: {
      dx?: number
      dy?: number
      bold?: boolean
      size?: number
      maxWidth?: number
      nth?: number
      yNear?: { y: number; range: number }
    } = {}
  ) => {
    if (value === null || value === undefined || value === '') return
    const a = findAnchor(page, anchorText, { nth: opts.nth, yNear: opts.yNear })
    if (!a) return
    const pg = pages[page]
    if (!pg) return
    const draw: Parameters<typeof pg.drawText>[1] = {
      x: a.x + (opts.dx ?? 0),
      y: a.y + (opts.dy ?? 0),
      size: opts.size ?? 9,
      font: opts.bold ? helveticaBold : helvetica,
      color: rgb(0, 0, 0),
    }
    if (opts.maxWidth) draw.maxWidth = opts.maxWidth
    pg.drawText(String(value), draw)
  }
  /** Place a tick mark just to the LEFT of the anchor label (typical checkbox location). */
  const tickAt = (
    page: number,
    anchorText: string,
    opts: { nth?: number; yNear?: { y: number; range: number } } = {}
  ) => drawAt(page, anchorText, 'X', { ...opts, dx: -12, dy: -1, bold: true, size: 11 })

  // Absolute-coordinate tick — used for checkboxes OCR didn't capture in A1 col
  const putTickAbs = (p: number, x: number, y: number) => {
    const pgObj = pages[p]
    if (!pgObj) return
    pgObj.drawText('X', { x, y, size: 11, font: helveticaBold, color: rgb(0, 0, 0) })
  }
  // Absolute-coordinate text — used when no reliable anchor exists
  const putTextAbs = (p: number, x: number, y: number, value: string | null | undefined,
                       opts: { bold?: boolean; size?: number; maxWidth?: number } = {}) => {
    if (!value) return
    const pgObj = pages[p]
    if (!pgObj) return
    const o: Parameters<typeof pgObj.drawText>[1] = {
      x, y, size: opts.size ?? 9,
      font: opts.bold ? helveticaBold : helvetica,
      color: rgb(0, 0, 0),
    }
    if (opts.maxWidth) o.maxWidth = opts.maxWidth
    pgObj.drawText(String(value), o)
  }

  // ── PAGE 0 — Financing Details / Requirement ─────────────────────────────
  // Product ticks (y≈643 row; A1 col≈146, OPF col≈259, Islamic col≈386)
  if (data.product_type === 'conventional') putTickAbs(0, 146, 642)
  if (data.product_type === 'opf')          putTickAbs(0, 259, 642)
  if (data.product_type === 'islamic')      putTickAbs(0, 386, 642)

  // Purpose ticks (single-select now)
  const purpose = data.purpose as string
  if (purpose === 'purchase')          tickAt(0, 'Purchase')
  if (purpose === 'topup')             tickAt(0, 'Top-up')
  if (purpose === 'refinance_cashout') tickAt(0, 'Refinance', { nth: 0 })

  // Refinance & cash-out purpose ticks
  const rp = data.refinance_purpose as string
  if (rp === 'paydown')     tickAt(0, 'Pay down')
  if (rp === 'education')   tickAt(0, 'Education')
  if (rp === 'renovation')  tickAt(0, 'Renovation')
  if (rp === 'medical')     tickAt(0, 'Medical')
  if (rp === 'investment')  tickAt(0, 'Investment')
  if (rp === 'business_wc') tickAt(0, 'Business working capital')

  // Financing amounts — new multi-row schema
  const homeLoan    = parseFloat((data.home_loan_amount as string) || '0') || 0
  const termLoan    = parseFloat((data.term_loan_amount as string) || '0') || 0
  const overdraft   = parseFloat((data.overdraft_amount as string) || '0') || 0
  const legalFee    = parseFloat((data.legal_fee_amount as string) || '0') || 0
  const valuationFee= parseFloat((data.valuation_fee_amount as string) || '0') || 0
  const stampDuty   = parseFloat((data.stamp_duty_amount as string) || '0') || 0
  const takaful     = parseFloat((data.takaful_premium_amount as string) || '0') || 0
  const totalFinance = homeLoan + termLoan + overdraft + legalFee + valuationFee + stampDuty + takaful

  const amtDx = 340, tenDx = 440
  // Home Loan / Housing-Term row
  if (homeLoan > 0) {
    drawAt(0, 'Home Loan/Financing-i', fmtCurrency(homeLoan), { dx: amtDx, dy: -2, bold: true })
    if (data.home_loan_tenure) drawAt(0, 'Home Loan/Financing-i', String(data.home_loan_tenure), { dx: tenDx, dy: -2 })
  }
  // Term Loan / Home-Equity row
  if (termLoan > 0) {
    drawAt(0, 'Term Loan/Financing-i', fmtCurrency(termLoan), { dx: amtDx, dy: -2, bold: true })
    if (data.term_loan_tenure) drawAt(0, 'Term Loan/Financing-i', String(data.term_loan_tenure), { dx: tenDx, dy: -2 })
  }
  // Overdraft row
  if (overdraft > 0) drawAt(0, 'Overdraft (if any)', fmtCurrency(overdraft), { dx: amtDx, dy: -2, bold: true })
  // Financing of Legal / Valuation / Stamp Duty / Takaful — aggregate
  const financingCosts = legalFee + valuationFee + stampDuty + takaful
  if (financingCosts > 0) drawAt(0, 'Financing of Legal', fmtCurrency(financingCosts), { dx: amtDx, dy: -2 })
  // Total
  drawAt(0, 'Total Financing Amount', fmtCurrency(totalFinance), { dx: amtDx, dy: -2, bold: true, size: 10 })

  // Instalment start option
  if (data.instalment_rental_start === 'service_interest')  tickAt(0, 'Service Interest')
  if (data.instalment_rental_start === 'start_instalment')  tickAt(0, 'Start Instalment')
  if (data.instalment_rental_start === 'immediate')         tickAt(0, 'Start Instalment')

  // Buyer–Seller relationship
  if (data.buyer_seller_relationship === 'immediate')     tickAt(0, 'Immediate Family')
  if (data.buyer_seller_relationship === 'non_immediate') tickAt(0, 'Non-immediate')

  // 1.1 Refinancing block
  drawAt(0, 'Current Financier',  data.current_bank_name as string,         { dx: 180, dy: -2 })
  drawAt(0, 'Existing Loan',      data.existing_loan_customer as string,    { dx: 180, dy: -2 })
  if (data.outstanding_balance) {
    // Outstanding balance: draw beside Existing Loan row (2nd occurrence offset)
    drawAt(0, 'Existing Loan', fmtCurrency(data.outstanding_balance), { dx: 180, dy: -16 })
  }

  // ── PAGE 1 top — Property details ────────────────────────────────────────
  // Type of Purchase ticks (y≈746)
  const top = data.type_of_purchase as string
  if (top === 'developer') tickAt(1, 'Developer')
  if (top === 'subsales')  tickAt(1, 'Subsales')
  if (top === 'refinance') tickAt(1, 'Refinancing', { nth: 0 })
  // Purpose of Property
  if (data.property_usage_purpose === 'owner_occupied') tickAt(1, 'Owner')
  if (data.property_usage_purpose === 'investment')     tickAt(1, 'Investment', { nth: 0 })
  // Construction stage
  if (data.construction_stage === 'completed')          tickAt(1, 'Completed')
  if (data.construction_stage === 'under_construction') tickAt(1, 'Under')
  // Project / Developer name (anchor positions: Developer's Name y=687.8)
  drawAt(1, "Developer’sName:", data.developer_name as string, { dx: 0, dy: -12, size: 8, maxWidth: 200 })
  drawAt(1, "Project",          data.project_name as string,   { dx: 30, dy: -2, size: 8, maxWidth: 180 })
  // CCC issued
  if (data.ccc_issued === 'yes') tickAt(1, 'CCCissued:')
  // Age of Property
  drawAt(1, 'Age', String(data.age_of_property || ''), { dx: 40, dy: 0, nth: 0 })
  // Title type
  if (data.title_type === 'master')     tickAt(1, 'Master')
  if (data.title_type === 'individual') tickAt(1, 'Individual')
  // Land type
  if (data.land_type === 'freehold')  tickAt(1, 'Freehold')
  if (data.land_type === 'leasehold') tickAt(1, 'Leasehold')

  // ── PAGE 1 bottom — Personal Details (2 columns: Applicant | Co-Applicant) ───
  // Row structure (calibrated from debug PDF screenshot):
  //   Applicant Type row:     y ≈ 365  (empty cell in A1, 3 ticks in A2)
  //   Name row:               y ≈ 338  (empty cell both columns)
  //   Salutation row:         y ≈ 311  (anchors: "mr","mrs","Miss")
  //   ID Type row (NRIC):     y ≈ 295  (anchor: "NRIC:")
  //   Old NRIC sub-row:       y ≈ 283
  //   Passport sub-row:       y ≈ 268
  //   Expiry Date sub-row:    y ≈ 256
  //   Entry Permit/Pass:      y ≈ 241
  //   Date of Birth row:      y ≈ 182  (no anchor; above [Gender at 161.5)
  //   Gender row:             y ≈ 167
  //   Race row:               y ≈ 151
  //   Bumi Status row:        y ≈ 135
  //   Marital Status row:     y ≈ 75
  // Applicant 1 column values go at x ≈ 200 (NRIC: at x=161.6 → dx=38).
  // Applicant 2 column anchors live at x=355.7 (NRIC:) — use nth:1.

  const name = data.client_name as string
  // Name row: anchor off NRIC:, offset up 42pt to land in the Name cell.
  drawAt(1, 'NRIC:', name, { dx: 38, dy: 42, bold: true, size: 10, nth: 0, maxWidth: 200 })
  // NRIC value
  drawAt(1, 'NRIC:', data.client_ic as string,       { dx: 38, dy: -2, nth: 0 })
  drawAt(1, 'NRIC', data.client_old_ic as string,    { dx: 120, dy: -2, nth: 0 })
  drawAt(1, 'Passport:', data.client_passport as string, { dx: 48, dy: -2, nth: 0 })
  // Date of Birth — no anchor; piggy-back off [Gender (y=161.5) + 15pt up
  drawAt(1, '[Gender', fmtDate(data.client_dob as string), { dx: 145, dy: 15, nth: 0 })

  // Salutation ticks — OCR only captured A2 column anchors (at x≈365-470).
  // For A1 we use absolute coordinates at y=311 (salutation row).
  // A1 checkbox x positions: Mr≈196, Mrs≈241, Miss≈296, Others≈348
  const titleLow = (data.client_title as string)?.toLowerCase()
  if (titleLow === 'mr')    putTickAbs(1, 196, 310)
  if (titleLow === 'mrs')   putTickAbs(1, 241, 310)
  if (titleLow === 'miss' || titleLow === 'ms') putTickAbs(1, 296, 310)
  if (titleLow === 'others') putTickAbs(1, 348, 310)

  // Gender tick
  if ((data.gender as string)?.toLowerCase() === 'female') tickAt(1, 'Female', { nth: 0 })
  if ((data.gender as string)?.toLowerCase() === 'male')   drawAt(1, '[Gender', 'X', { dx: 95, dy: 4, bold: true, size: 11 })

  // Race ticks at y=151
  const race = (data.race as string)?.toLowerCase()
  if (race === 'malay')   tickAt(1, 'Malay',   { nth: 0 })
  if (race === 'chinese') tickAt(1, 'Chinese', { nth: 0 })
  // Indian — no clean anchor; offset from Chinese
  if (race === 'indian')  drawAt(1, 'Chinese', 'X', { dx: 60, dy: -1, bold: true, size: 11, nth: 0 })

  // Bumi status — anchors "OBumi" and "Non-Bumi" at y=134.8
  if (data.bumiputra === true || data.bumiputra === 'yes') tickAt(1, 'OBumi',    { nth: 0 })
  if (data.bumiputra === false || data.bumiputra === 'no') tickAt(1, 'Non-Bumi', { nth: 0 })

  // Marital status ticks (A1 column absolute coords — row y≈74)
  // A1: Single≈152, Married≈197, Widowed≈248, Divorced≈297
  const ms = (data.marital_status as string)?.toLowerCase()
  if (ms === 'single')   putTickAbs(1, 152, 74)
  if (ms === 'married')  putTickAbs(1, 197, 74)
  if (ms === 'widowed')  putTickAbs(1, 248, 74)
  if (ms === 'divorced') putTickAbs(1, 297, 74)

  // ── PAGE 2 — Permanent Address / Mailing Address ─────────────────────────
  // "Address" anchor at y=722.4 is the leftmost label column. Value cell starts x≈200.
  drawAt(2, 'Address', data.home_address as string, { dx: 130, dy: 0, size: 8, maxWidth: 420, nth: 0 })
  drawAt(2, 'Postcode:', data.post_code as string,  { dx: 50, dy: -2, nth: 0 })

  // ── PAGE 3 — Employment Details ──────────────────────────────────────────
  // Applicant 1 column starts x ≈ 200. Row ys (calibrated):
  //   Employment Type row:    y ≈ 717 (ticks)
  //   Employer Name row:      y ≈ 670 (empty)
  //   Occupation/Position:    y ≈ 500 (empty)
  //   Nature of Business:     y ≈ 475 (empty)
  //   Monthly Income:         y ≈ 220 (anchor "MONTHLY" x=115.6 → dx=115)

  // Employment status ticks — anchor words at y=717
  const emp = (data.employment_type as string)?.toLowerCase()
  if (emp === 'salaried' || emp === 'employed')    tickAt(3, 'salaried',   { nth: 0 })
  if (emp === 'commission')                        tickAt(3, 'Commission', { nth: 0 })
  if (emp === 'self_employed' || emp === 'self-employed') tickAt(3, 'Self-employed', { nth: 0 })
  if (emp === 'housewife')                         tickAt(3, 'Housewife',  { nth: 0 })
  if (emp === 'pensioner' || emp === 'retiree')    tickAt(3, 'Pensioner',  { nth: 0 })

  // Employer name — no direct anchor; use "APPLICANT" header at y=733 as ref.
  drawAt(3, 'APPLICANT', data.employer_name as string, { dx: -25, dy: -65, bold: true, size: 10, maxWidth: 200, nth: 0 })

  // Occupation — "Occupation" anchor at y=507 is leftmost label; value at x≈210
  drawAt(3, 'Occupation', data.occupation as string, { dx: 150, dy: -2, nth: 0, maxWidth: 200 })

  // Nature of Business — no dedicated anchor; offset down from Occupation
  drawAt(3, 'Occupation', data.nature_of_business as string, { dx: 150, dy: -20, nth: 0, maxWidth: 200 })

  // Monthly income — "MONTHLY" at x=115.6, y=219.4 → value into Applicant 1 col
  drawAt(3, 'MONTHLY', fmtCurrency(data.monthly_income), { dx: 115, dy: 0, bold: true, nth: 0 })

  // Applicant Type row (y≈365) — A1 column absolute coords
  // A1: Main≈152, Co-Applicant≈220, Guarantor≈290, Chargor≈348
  const aType = (data.applicant_type as string)?.toLowerCase()
  if (aType === 'main')         putTickAbs(1, 152, 365)
  if (aType === 'co_applicant') putTickAbs(1, 220, 365)
  if (aType === 'guarantor')    putTickAbs(1, 290, 365)
  if (aType === 'chargor')      putTickAbs(1, 348, 365)

  // Entry permit type (A1 col, row y≈241) — Work/Student/Dependant/Other
  const ep = (data.entry_permit_type as string)?.toLowerCase()
  if (ep === 'work')      putTickAbs(1, 196, 241)
  if (ep === 'student')   putTickAbs(1, 241, 241)
  if (ep === 'dependant') putTickAbs(1, 296, 241)
  if (ep === 'other')     putTickAbs(1, 348, 241)
  if (data.entry_permit_expiry_date) {
    putTextAbs(1, 200, 256, fmtDate(data.entry_permit_expiry_date as string), { size: 8 })
  }

  // ── APPLICANT 2 column mirror (x>=350 on page 1) ─────────────────────────
  if (data.a2_enabled) {
    const a2Type = (data.a2_type as string)?.toLowerCase()
    if (a2Type === 'main')         putTickAbs(1, 378, 365)
    if (a2Type === 'co_applicant') putTickAbs(1, 436, 365)
    if (a2Type === 'guarantor')    putTickAbs(1, 496, 365)
    if (a2Type === 'chargor')      putTickAbs(1, 550, 365)

    // A2 name / IDs using NRIC nth:1 anchor
    drawAt(1, 'NRIC:', data.a2_name as string,
      { dx: 38, dy: 42, bold: true, size: 10, nth: 1, maxWidth: 200 })
    drawAt(1, 'NRIC:', data.a2_ic as string,       { dx: 38, dy: -2, nth: 1 })
    drawAt(1, 'Passport:', data.a2_passport as string, { dx: 48, dy: -2, nth: 1 })

    const a2Title = (data.a2_title as string)?.toLowerCase()
    if (a2Title === 'mr')   putTickAbs(1, 378, 310)
    if (a2Title === 'mrs')  putTickAbs(1, 423, 310)
    if (a2Title === 'miss' || a2Title === 'ms') putTickAbs(1, 478, 310)
    if (a2Title === 'others') putTickAbs(1, 530, 310)

    // A2 DOB — piggyback off [Gender nth:1
    drawAt(1, '[Gender', fmtDate(data.a2_dob as string), { dx: 145, dy: 15, nth: 1 })

    // A2 gender
    const a2Gender = (data.a2_gender as string)?.toLowerCase()
    if (a2Gender === 'male')   drawAt(1, '[Gender', 'X', { dx: 95, dy: 4, bold: true, size: 11, nth: 1 })
    if (a2Gender === 'female') tickAt(1, 'Female', { nth: 1 })

    // A2 race
    const a2Race = (data.a2_race as string)?.toLowerCase()
    if (a2Race === 'malay')   tickAt(1, 'Malay',   { nth: 1 })
    if (a2Race === 'chinese') tickAt(1, 'Chinese', { nth: 1 })
    if (a2Race === 'indian')  drawAt(1, 'Chinese', 'X', { dx: 60, dy: -1, bold: true, size: 11, nth: 1 })

    if (data.a2_bumiputra === true || data.a2_bumiputra === 'yes') tickAt(1, 'OBumi',    { nth: 1 })
    if (data.a2_bumiputra === false || data.a2_bumiputra === 'no') tickAt(1, 'Non-Bumi', { nth: 1 })

    // A2 marital (row y≈74, A2 col)
    const a2ms = (data.a2_marital as string)?.toLowerCase()
    if (a2ms === 'single')   putTickAbs(1, 378, 74)
    if (a2ms === 'married')  putTickAbs(1, 423, 74)
    if (a2ms === 'widowed')  putTickAbs(1, 478, 74)
    if (a2ms === 'divorced') putTickAbs(1, 530, 74)

    // A2 residence/contact on page 2
    drawAt(2, 'Address', data.a2_home_address as string, { dx: 130, dy: -200, size: 8, maxWidth: 420 })
    // A2 employment on page 3 — use APPLICANT header nth:1
    drawAt(3, 'APPLICANT', data.a2_employer_name as string, { dx: -25, dy: -65, bold: true, size: 10, maxWidth: 200, nth: 1 })
    drawAt(3, 'Occupation', data.a2_occupation as string,           { dx: 150, dy: -2, nth: 1, maxWidth: 200 })
    drawAt(3, 'Occupation', data.a2_nature_of_business as string,   { dx: 150, dy: -20, nth: 1, maxWidth: 200 })
    drawAt(3, 'MONTHLY', fmtCurrency(data.a2_monthly_income),       { dx: 115, dy: 0, bold: true, nth: 1 })
  }

  // ── PAGE 2 — Residence / Contact additional fields ───────────────────────
  // Residence type (row y≈640): own / mortgaged / parents / rented / employer / others
  const resType = (data.residence_type as string)?.toLowerCase()
  const resMap: Record<string, number> = {
    own: 152, mortgaged: 210, parents: 275, rented: 335, employer: 395, others: 460,
  }
  if (resType && resMap[resType]) putTickAbs(2, resMap[resType], 640)
  if (data.years_at_address) putTextAbs(2, 200, 615, String(data.years_at_address))

  // Mailing address type (row y≈560): same / office / other
  const mailType = (data.mailing_address_type as string)?.toLowerCase()
  if (mailType === 'same')   putTickAbs(2, 152, 560)
  if (mailType === 'office') putTickAbs(2, 210, 560)
  if (mailType === 'other')  putTickAbs(2, 275, 560)
  if (mailType === 'other' && data.alternate_address) {
    putTextAbs(2, 200, 540, data.alternate_address as string, { size: 8, maxWidth: 340 })
  }

  // Residency status (4 variants) — absolute positions on row y≈470
  const rs = (data.residency_status as string)?.toLowerCase()
  if (rs === 'my_no_pr')            putTickAbs(2, 152, 470)
  if (rs === 'my_with_pr')          putTickAbs(2, 210, 470)
  if (rs === 'non_my_resident')     putTickAbs(2, 275, 470)
  if (rs === 'non_my_non_resident') putTickAbs(2, 335, 470)
  if ((rs === 'non_my_resident' || rs === 'non_my_non_resident') && data.other_country_name) {
    putTextAbs(2, 200, 450, data.other_country_name as string, { size: 8 })
  }

  // Three separate phones
  drawAt(2, 'Mobile',   data.client_phone_mobile as string, { dx: 60, dy: -2, nth: 0 })
  drawAt(2, 'Home',     data.client_phone_home as string,   { dx: 60, dy: -2, nth: 0 })
  drawAt(2, 'Office',   data.client_phone_office as string, { dx: 60, dy: -2, nth: 0 })
  drawAt(2, 'Email',    data.client_email as string,        { dx: 60, dy: -2, size: 8, nth: 0, maxWidth: 320 })

  // Emergency contact
  drawAt(2, 'Emergency', data.emergency_contact_name as string,  { dx: 0, dy: -14, size: 8, nth: 0, maxWidth: 200 })
  drawAt(2, 'Emergency', data.emergency_contact_relation as string, { dx: 200, dy: -14, size: 8, nth: 0 })
  drawAt(2, 'Emergency', data.emergency_contact_phone as string, { dx: 340, dy: -14, size: 8, nth: 0 })

  // Education level (row y≈390): pmr / spm / stpm / diploma / degree / master / phd / others
  const edu = (data.education_level as string)?.toLowerCase()
  const eduMap: Record<string, number> = {
    pmr: 152, spm: 196, stpm: 240, diploma: 285, degree: 340, master: 395, phd: 450, others: 505,
  }
  if (edu && eduMap[edu]) putTickAbs(1, eduMap[edu], 55)
  if (data.spouse_nationality) putTextAbs(1, 200, 40, data.spouse_nationality as string, { size: 8 })
  if (data.no_of_dependants != null) putTextAbs(1, 260, 92, String(data.no_of_dependants))

  // ── PAGE 3 — Employment: business entity, status, PEP, previous employer ─
  // Business entity (row y≈660): sole_prop / partnership / sdn_bhd / bhd / gov / statutory / ngo / others
  const be = (data.business_entity as string)?.toLowerCase()
  const beMap: Record<string, [number, number]> = {
    sole_prop:   [152, 660],
    partnership: [220, 660],
    sdn_bhd:     [290, 660],
    bhd:         [360, 660],
    gov:         [420, 660],
    statutory:   [152, 640],
    ngo:         [220, 640],
    others:      [290, 640],
  }
  if (be && beMap[be]) putTickAbs(3, beMap[be][0], beMap[be][1])

  // Employment status (row y≈560): permanent / probation / contractual
  const es = (data.employment_status as string)?.toLowerCase()
  if (es === 'permanent')   putTickAbs(3, 152, 560)
  if (es === 'probation')   putTickAbs(3, 220, 560)
  if (es === 'contractual') putTickAbs(3, 295, 560)

  // Office postcode
  drawAt(3, 'Postcode', data.office_postcode as string, { dx: 50, dy: -2, nth: 0 })

  // Previous employer
  drawAt(3, 'Previous', data.prev_employer_name as string, { dx: 100, dy: -2, nth: 0, maxWidth: 200 })
  if (data.prev_employer_years || data.prev_employer_months) {
    const py = String(data.prev_employer_years || 0)
    const pm = String(data.prev_employer_months || 0)
    drawAt(3, 'Previous', `${py} yr ${pm} mth`, { dx: 340, dy: -2, nth: 0 })
  }

  // PEP checkboxes (row y≈120 at Politically Exposed Person section)
  // politician / diplomat / government_officer / senior_mgmt_intl_org / royal_family / not_applicable
  if (data.pep_politician)             putTickAbs(3, 152, 130)
  if (data.pep_diplomat)               putTickAbs(3, 220, 130)
  if (data.pep_government_officer)     putTickAbs(3, 295, 130)
  if (data.pep_senior_mgmt_intl_org)   putTickAbs(3, 152, 110)
  if (data.pep_royal_family)           putTickAbs(3, 220, 110)
  if (data.pep_not_applicable)         putTickAbs(3, 295, 110)

  // ── PAGE 5 — Existing Facilities (up to 3 rows) ──────────────────────────
  // Rows stacked every ~28pt starting y≈640
  const facRows = [
    { y: 640, bank: data.ef1_bank, nature: data.ef1_nature, monthly: data.ef1_monthly, outstanding: data.ef1_outstanding },
    { y: 612, bank: data.ef2_bank, nature: data.ef2_nature, monthly: data.ef2_monthly, outstanding: data.ef2_outstanding },
    { y: 584, bank: data.ef3_bank, nature: data.ef3_nature, monthly: data.ef3_monthly, outstanding: data.ef3_outstanding },
  ]
  for (const r of facRows) {
    if (r.bank) putTextAbs(5, 60, r.y, r.bank as string, { size: 8, maxWidth: 130 })
    if (r.nature) putTextAbs(5, 200, r.y, r.nature as string, { size: 8, maxWidth: 130 })
    if (r.monthly) putTextAbs(5, 340, r.y, fmtCurrency(r.monthly), { size: 8 })
    if (r.outstanding) putTextAbs(5, 460, r.y, fmtCurrency(r.outstanding), { size: 8 })
  }

  // ── PAGE 9 — FATCA ───────────────────────────────────────────────────────
  if (data.fatca_us_person === true || data.fatca_us_person === 'yes') {
    putTickAbs(9, 152, 500)
    if (data.fatca_us_tin) putTextAbs(9, 200, 470, data.fatca_us_tin as string, { size: 9 })
  } else if (data.fatca_us_person === false || data.fatca_us_person === 'no') {
    putTickAbs(9, 210, 500)
  }

  // Footer stamp — last page
  const lastPg = pages[pages.length - 1]
  if (lastPg) {
    lastPg.drawText(
      `QAI Case: ${(data.case_code as string) || 'DRAFT'}  |  ${new Date().toLocaleDateString('en-MY')}`,
      { x: 50, y: 20, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5) }
    )
  }

  return pdfDoc.save()
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * Debug-mode OCBC overlay: for every OCR-found anchor on every page, draw a
 * red dot at (x, y) and the word's text beside it (tiny red). Lets the user
 * visually confirm where every anchor actually lives, so field offsets can be
 * tuned precisely instead of guessed.
 */
async function overlayOCBCDebug(templateBytes: Uint8Array): Promise<Uint8Array> {
  const anchors = loadOcbcAnchors()
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  for (let p = 0; p < pages.length; p++) {
    const pg = pages[p]
    const items = anchors.pages[p]?.items ?? []
    for (const it of items) {
      // red dot at anchor origin (bottom-left of the word's bbox)
      pg.drawCircle({ x: it.x, y: it.y, size: 1.2, color: rgb(1, 0, 0) })
      pg.drawText(it.text, {
        x: it.x + 2,
        y: it.y + 2,
        size: 4,
        font: helvetica,
        color: rgb(0.85, 0, 0),
      })
    }
    // page index stamp (top-left)
    pg.drawText(`PAGE ${p}  (${items.length} anchors)`, {
      x: 10, y: 820, size: 8, font: helvetica, color: rgb(0, 0.4, 0.8),
    })
  }
  return pdfDoc.save()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { caseId, debug } = body as { caseId?: string; debug?: string }

  if (!caseId) {
    return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
  }

  // Fetch case (admin client — no RLS)
  const supabase = getAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: caseRow, error: caseError } = await (supabase as any)
    .from('cases')
    .select('*, proposed_bank:banks(name)')
    .eq('id', caseId)
    .single()

  if (caseError || !caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  // Flatten bank_form_data into the data object so all fields are accessible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = caseRow as any
  const data: Record<string, unknown> = { ...raw, ...(raw.bank_form_data || {}) }

  // Detect HLB by bank name (proposed_bank join) or legacy string key in bank_form_data
  const bankName = ((raw.proposed_bank as any)?.name || '').toLowerCase()
  const isHLB = bankName.includes('hong leong') || data.selected_bank === 'hong_leong_bank'
  const templateName = isHLB
    ? 'HONG LEONG BANK APPLICATION FORM.pdf'
    : 'OCBC APPLICATION FORM 0225 (portrait).pdf' // portrait-rotated copy — native 595×842 coord space
  const templatePath = path.join(process.cwd(), 'Forms', templateName)

  let pdfBytes: Uint8Array | null = null
  let usedTemplate = false

  // ── Attempt 1: Overlay on official template ───────────────────────────────
  // The OCBC overlay MUST succeed — if it doesn't, we return the real error
  // instead of silently swapping in a generic clean PDF (which doesn't look
  // like the bank form at all and hides the real bug).
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({
      error: 'Bank template not found',
      detail: `Expected file at ${templatePath}`,
    }, { status: 500 })
  }

  try {
    const templateBytes = fs.readFileSync(templatePath)
    if (isHLB) {
      pdfBytes = await overlayHLB(new Uint8Array(templateBytes), data)
    } else if (debug === 'anchors') {
      pdfBytes = await overlayOCBCDebug(new Uint8Array(templateBytes))
    } else {
      pdfBytes = await overlayOCBC(new Uint8Array(templateBytes), data)
    }
    usedTemplate = true
  } catch (templateErr) {
    console.error('[generate-pdf] Template overlay failed:', templateErr)
    return NextResponse.json({
      error: 'Template overlay failed',
      detail: templateErr instanceof Error ? templateErr.message : String(templateErr),
      stack: templateErr instanceof Error ? templateErr.stack : undefined,
    }, { status: 500 })
  }

  if (!pdfBytes) {
    return NextResponse.json({ error: 'PDF generation produced no bytes' }, { status: 500 })
  }

  // Silence unused-import warning for generateCleanPdf — kept for manual fallback tests
  void generateCleanPdf

  const base64Pdf = Buffer.from(pdfBytes).toString('base64')
  const filename = `Application_Form_${(data.case_code as string) || caseId}.pdf`

  return NextResponse.json({
    success: true,
    pdf: base64Pdf,
    filename,
    source: usedTemplate ? 'template_overlay' : 'clean_pdf',
  })
}
