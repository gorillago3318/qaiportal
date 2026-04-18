import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

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

function fmtCurrency(v: number | string | null | undefined): string {
  if (!v) return ''
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n)) return ''
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
  field('Tenure', data.facility_tenure_months ? `${data.facility_tenure_months} months` : data.loan_tenure ? `${data.loan_tenure} years` : undefined)
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
  const tick = (key: string) => draw(key, '✓', { bold: true, size: 11 })

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
  const tenure = data.facility_tenure_months || data.loan_tenure
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

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { caseId } = await request.json().catch(() => ({}))

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
    : 'OCBC APPLICATION FORM 0225.pdf'
  const templatePath = path.join(process.cwd(), 'Forms', templateName)

  let pdfBytes: Uint8Array | null = null
  let usedTemplate = false

  // ── Attempt 1: Overlay on official template ───────────────────────────────
  if (fs.existsSync(templatePath)) {
    try {
      const templateBytes = fs.readFileSync(templatePath)
      if (isHLB) {
        pdfBytes = await overlayHLB(new Uint8Array(templateBytes), data)
        usedTemplate = true
      } else {
        // OCBC — minimal overlay until fully calibrated
        const pdfDoc = await PDFDocument.load(new Uint8Array(templateBytes), { ignoreEncryption: true })
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const pg = pdfDoc.getPages()[0]
        if (pg) {
          pg.drawText(data.client_name as string || '', { x: 95, y: 520, size: 9, font, color: rgb(0,0,0) })
          pg.drawText(data.client_ic as string || '', { x: 95, y: 495, size: 9, font, color: rgb(0,0,0) })
        }
        pdfBytes = await pdfDoc.save()
        usedTemplate = true
      }
    } catch (templateErr) {
      // Template failed (encrypted, corrupted, wrong page layout, etc.) — fall through to clean PDF
      console.warn('[generate-pdf] Template overlay failed, using clean PDF:', templateErr)
    }
  }

  // ── Attempt 2: Clean structured PDF (always succeeds) ────────────────────
  if (!pdfBytes) {
    try {
      pdfBytes = await generateCleanPdf(data, isHLB)
    } catch (cleanErr) {
      console.error('[generate-pdf] Even clean PDF failed:', cleanErr)
      return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
    }
  }

  const base64Pdf = Buffer.from(pdfBytes).toString('base64')
  const filename = `Application_Form_${(data.case_code as string) || caseId}.pdf`

  return NextResponse.json({
    success: true,
    pdf: base64Pdf,
    filename,
    source: usedTemplate ? 'template_overlay' : 'clean_pdf',
  })
}
