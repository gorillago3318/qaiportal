'use client'

import React, { useState } from 'react'
import { Printer, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Coordinate helpers ───────────────────────────────────────────────────────
// PDF space: 595pt wide × 842pt tall, y=0 at BOTTOM (pdf-lib convention)
// CSS space: percentage-based, y=0 at TOP
// left%  = x / 595 × 100
// top%   = (842 − y) / 842 × 100
// Text is shifted up 75% of its own height to approximate baseline alignment

const PW = 595   // page width in pts
const PH = 842   // page height in pts

function pct(x: number, y: number) {
  return {
    left: `${((x / PW) * 100).toFixed(4)}%`,
    top:  `${(((PH - y) / PH) * 100).toFixed(4)}%`,
  }
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function fmtDate(s?: string | null) {
  if (!s) return ''
  if (s.includes('/')) return s
  if (s.length === 10 && s.includes('-')) {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  return s
}

function fmtMoney(v?: number | string | null) {
  if (v === null || v === undefined || v === '') return ''
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n)) return ''
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Single absolutely-positioned text field ──────────────────────────────────
interface FProps {
  v:        string | null | undefined
  x:        number
  y:        number
  bold?:    boolean
  size?:    number   // in pt
  maxW?:    number   // max-width in pts (same scale as x)
}

function F({ v, x, y, bold, size = 9, maxW }: FProps) {
  if (!v) return null
  const pos = pct(x, y)
  return (
    <span
      style={{
        position:   'absolute',
        left:        pos.left,
        top:         pos.top,
        transform:  'translateY(-75%)',   // align baseline to coordinate
        fontSize:   `${size}pt`,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontWeight:  bold ? 700 : 400,
        lineHeight:  1,
        color:      '#000',
        whiteSpace:  maxW ? 'normal' : 'nowrap',
        maxWidth:    maxW ? `${((maxW / PW) * 100).toFixed(2)}%` : undefined,
        overflow:   'hidden',
        wordBreak:   maxW ? 'break-word' : undefined,
      }}
    >
      {v}
    </span>
  )
}

// Tick-mark shorthand
function T({ x, y }: { x: number; y: number }) {
  return <F v="✓" x={x} y={y} bold size={11} />
}

// ─── One A4 page wrapper ──────────────────────────────────────────────────────
function FormPage({
  pageNum,
  children,
  missing,
}: {
  pageNum: number
  children: React.ReactNode
  missing: boolean
}) {
  return (
    <div
      className="form-page relative mx-auto mb-2 print:mb-0 bg-white overflow-hidden"
      style={{ width: '210mm', height: '297mm', breakAfter: 'page' }}
    >
      {missing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 border border-dashed border-gray-300">
          <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
          <p className="text-sm text-gray-500">page-{pageNum}.png not found</p>
          <p className="text-xs text-gray-400 mt-1">Run Admin → Convert Forms first</p>
        </div>
      ) : (
        <img
          src={`/forms/hlb/page-${pageNum}.png`}
          alt={`HLB form page ${pageNum}`}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'fill' }}
          onError={(e) => {
            // Hide broken image; parent will not show overlay text either
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      {!missing && children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface HLBFormPreviewProps {
  data: Record<string, any>
  onClose?: () => void
}

export function HLBFormPreview({ data: d, onClose }: HLBFormPreviewProps) {
  // Check which PNG pages exist by probing with fetch
  const [pngStatus, setPngStatus] = useState<Record<number, boolean>>({})
  const [checked, setChecked] = useState(false)

  React.useEffect(() => {
    fetch('/api/admin/save-form-image?bank=hlb')
      .then(r => r.json())
      .then((result: { pages: number[] }) => {
        const map: Record<number, boolean> = {}
        for (let i = 1; i <= 7; i++) map[i] = result.pages.includes(i)
        setPngStatus(map)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [])

  const noPngs = checked && !Object.values(pngStatus).some(Boolean)

  // ── Derived display values ─────────────────────────────────────────────────
  const purposes: string[] = Array.isArray(d.purpose_of_financing)
    ? d.purpose_of_financing
    : d.purpose_of_financing ? [d.purpose_of_financing] : []

  const refPurposes: string[] = Array.isArray(d.refinance_purpose)
    ? d.refinance_purpose
    : d.refinance_purpose ? [d.refinance_purpose] : []

  const ins = d.insurance_type as string
  const hasIns = ins && ins !== 'none'

  const lt = (d.financing_type || d.loan_type || '') as string

  const titleMap: Record<string, string> = { mr: 'Mr', ms: 'Ms', mrs: 'Mrs', dr: 'Dr' }
  const clientTitle = titleMap[(d.client_title as string)?.toLowerCase()] || (d.client_title as string)

  const empMap: Record<string, string> = {
    salaried: 'Salaried',
    professional: 'Professional',
    self_employed: 'Self-Employed',
    others: 'Others',
  }

  const correspondenceAddr = d.correspondence_same_as_home === 'yes' || d.correspondence_same_as_home === true
    ? '(Same as home address)'
    : (d.correspondence_address as string)

  return (
    <>
      {/* ── Print stylesheet ──────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body > * { display: none !important; }
          .hlb-print-root { display: block !important; }
          .no-print { display: none !important; }
          .form-page {
            width: 210mm !important;
            height: 297mm !important;
            position: relative !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
          }
          .form-page img {
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
          }
        }
      `}</style>

      <div className="hlb-print-root fixed inset-0 z-[100] bg-white overflow-auto print:static print:overflow-visible">
        {/* ── Screen toolbar ──────────────────────────────────────────────── */}
        <div className="no-print sticky top-0 z-[110] bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0A1628]">HLB Application Form Preview</h2>
            <p className="text-xs text-gray-500 mt-0.5">Data overlaid on official bank form. Click Print to produce PDF.</p>
          </div>
          <div className="flex gap-2">
            {noPngs && (
              <a
                href="/admin/convert-forms"
                target="_blank"
                className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              >
                ⚠ Generate form images first →
              </a>
            )}
            <Button
              onClick={() => window.print()}
              className="bg-[#0A1628] hover:bg-[#1a2d4a] text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print / Save PDF
            </Button>
            {onClose && (
              <Button variant="ghost" onClick={onClose}>✕ Close</Button>
            )}
          </div>
        </div>

        {/* ── Page wrapper — visible on screen, printed at A4 ─────────────── */}
        <div className="no-print py-6 bg-gray-200 min-h-screen">
          <PagesContent d={d} pngStatus={pngStatus} checked={checked}
            purposes={purposes} refPurposes={refPurposes} ins={ins} hasIns={hasIns}
            lt={lt} clientTitle={clientTitle} empMap={empMap} correspondenceAddr={correspondenceAddr}
          />
        </div>

        {/* Print-only: pages without the wrapper */}
        <div className="hidden print:block">
          <PagesContent d={d} pngStatus={pngStatus} checked={checked}
            purposes={purposes} refPurposes={refPurposes} ins={ins} hasIns={hasIns}
            lt={lt} clientTitle={clientTitle} empMap={empMap} correspondenceAddr={correspondenceAddr}
          />
        </div>
      </div>
    </>
  )
}

// ─── The actual pages (shared between screen preview and print view) ──────────
function PagesContent({
  d, pngStatus, checked,
  purposes, refPurposes, ins, hasIns, lt, clientTitle, empMap, correspondenceAddr,
}: {
  d: Record<string, any>
  pngStatus: Record<number, boolean>
  checked: boolean
  purposes: string[]
  refPurposes: string[]
  ins: string
  hasIns: boolean
  lt: string
  clientTitle: string
  empMap: Record<string, string>
  correspondenceAddr: string | undefined
}) {
  const missing = (n: number) => checked && !pngStatus[n]

  // ── PAGE 1 — Section A: Financing Requirement ──────────────────────────────
  const loanAmt = d.facility_amount || d.loan_amount || d.proposed_loan_amount

  // ── PAGE 2 — Section B: Property Details ──────────────────────────────────
  // ── PAGE 3 — Section E Part A: Personal ───────────────────────────────────
  // ── PAGE 4 — Section E Part B: Employment ─────────────────────────────────

  return (
    <>
      {/* ════════════ PAGE 1 — Section A ════════════ */}
      <FormPage pageNum={1} missing={missing(1)}>
        {/* Purpose of Financing checkboxes */}
        {purposes.includes('purchase_own')        && <T x={285} y={614} />}
        {purposes.includes('purchase_business')   && <T x={285} y={598} />}
        {purposes.includes('purchase_investment') && <T x={285} y={582} />}
        {purposes.includes('refinance')           && <T x={285} y={566} />}
        {purposes.includes('renovation')          && <T x={285} y={550} />}
        {purposes.includes('solar_panel')         && <T x={285} y={534} />}

        {/* Facility amount + tenure */}
        <F v={fmtMoney(loanAmt)} x={335} y={511} bold />
        {(d.facility_tenure_months || d.loan_tenure) && (
          <F v={String(d.facility_tenure_months || d.loan_tenure)} x={468} y={511} />
        )}

        {/* Finance costs */}
        {(d.finance_legal_cost === 'yes' || d.finance_legal_cost === true) && (
          <F v={fmtMoney(d.legal_cost_amount)} x={335} y={440} />
        )}
        {(d.finance_valuation_cost === 'yes' || d.finance_valuation_cost === true) && (
          <F v={fmtMoney(d.valuation_cost_amount)} x={335} y={418} />
        )}

        {/* Refinancing */}
        <F v={d.current_bank_name} x={175} y={391} />
        {refPurposes.includes('interest_saving') && <T x={285} y={363} />}
        {refPurposes.includes('working_capital')  && <T x={285} y={348} />}
        {refPurposes.includes('renovation')       && <T x={285} y={318} />}

        {/* Insurance */}
        {hasIns && <>
          <F v={String(d.insurance_financed_by || '').toUpperCase()} x={335} y={258} />
          <F v={ins.toUpperCase()}                                    x={285} y={243} />
          <F v={fmtMoney(d.insurance_premium_amount)}                 x={175} y={226} />
          {d.insurance_term_months   && <F v={String(d.insurance_term_months)}   x={335} y={209} />}
          {d.deferment_period_months && <F v={String(d.deferment_period_months)} x={335} y={192} />}
          <F v={fmtMoney(d.sum_insured_main)}  x={175} y={173} />
          <F v={fmtMoney(d.sum_insured_joint)} x={175} y={154} />
        </>}
      </FormPage>

      {/* ════════════ PAGE 2 — Section B: Property ════════════ */}
      <FormPage pageNum={2} missing={missing(2)}>
        {/* Financing type */}
        {(lt === 'developer' || lt === 'purchase_developer') && <T x={285} y={620} />}
        {(lt === 'subsale'   || lt === 'subsales')           && <T x={285} y={606} />}
        {lt === 'refinance'                                  && <T x={285} y={592} />}

        <F v={d.developer_seller_name}               x={175} y={540} />
        <F v={d.project_name}                        x={175} y={519} />
        <F v={d.property_address}  x={175} y={495} size={8} maxW={280} />
        <F v={d.property_city}                       x={175} y={473} />
        <F v={d.property_post_code}                  x={415} y={473} />
        <F v={d.property_state}                      x={175} y={458} />
        <F v={d.property_country || 'Malaysia'}      x={415} y={458} />
        <F v={fmtMoney(d.purchase_price)}            x={175} y={446} bold />
        {d.land_size_sqft    && <F v={String(d.land_size_sqft)}    x={175} y={401} />}
        {d.buildup_size_sqft && <F v={String(d.buildup_size_sqft)} x={175} y={381} />}
        <F v={d.title_type}  x={285} y={271} />
        <F v={d.land_tenure} x={285} y={127} />
      </FormPage>

      {/* ════════════ PAGE 3 — Section E: Personal Details ════════════ */}
      <FormPage pageNum={3} missing={missing(3)}>
        {/* Identity — rows above the Residency Status table */}
        {/* Title: tick the correct checkbox */}
        {clientTitle === 'Mr'  && <T x={178} y={769} />}
        {clientTitle === 'Ms'  && <T x={226} y={769} />}
        {clientTitle === 'Mrs' && <T x={268} y={769} />}
        {clientTitle && !['Mr','Ms','Mrs'].includes(clientTitle) && <T x={312} y={769} />}
        <F v={d.client_name}     x={350} y={769} bold size={9} maxW={240} />
        <F v={d.client_ic}       x={175} y={749} />
        <F v={d.client_old_ic}   x={175} y={729} />
        <F v={d.client_passport} x={175} y={709} />

        {/* Personal details — BELOW the Residency Status table (~50% down the page) */}
        <F v={fmtDate(d.client_dob)}    x={285} y={398} />
        <F v={(d.bumiputra === true || d.bumiputra === 'yes') ? 'Yes' : 'No'} x={285} y={381} />
        <F v={(d.gender === 'male') ? 'Male' : (d.gender === 'female') ? 'Female' : d.gender} x={285} y={363} />
        <F v={d.race ? String(d.race).charAt(0).toUpperCase() + String(d.race).slice(1) : ''} x={175} y={345} />
        <F v={d.marital_status ? String(d.marital_status).charAt(0).toUpperCase() + String(d.marital_status).slice(1) : ''} x={175} y={327} />
        <F v={d.no_of_dependants !== undefined ? String(d.no_of_dependants) : '0'} x={175} y={308} />
        <F v={d.home_address}     x={175} y={288} size={8} maxW={275} />
        <F v={d.city}             x={175} y={268} />
        <F v={d.post_code}        x={415} y={268} />
        <F v={d.state}            x={175} y={252} />
        <F v={d.country || 'Malaysia'} x={415} y={252} />
        {d.years_at_address && <F v={String(d.years_at_address)} x={175} y={236} />}
        <F v={correspondenceAddr} x={175} y={216} size={8} maxW={275} />

        {/* Contact — bottom of page */}
        <F v={d.client_phone} x={370} y={168} />
        <F v={d.client_email} x={175} y={120} size={8} />
      </FormPage>

      {/* ════════════ PAGE 4 — Section E: Employment ════════════ */}
      <FormPage pageNum={4} missing={missing(4)}>
        <F v={empMap[d.employment_type] || d.employment_type} x={285} y={750} />
        <F v={d.employer_name}         x={175} y={718} />
        <F v={d.nature_of_business}    x={175} y={685} />
        <F v={d.occupation}            x={175} y={652} />
        <F v={d.employer_address}      x={175} y={610} size={8} maxW={275} />
        <F v={d.office_tel}            x={175} y={556} />
        {d.length_service_years  && <F v={String(d.length_service_years)}  x={175} y={528} />}
        {d.length_service_months && <F v={String(d.length_service_months)} x={415} y={528} />}
        <F v={fmtMoney(d.monthly_income)}                           x={175} y={492} bold />
        <F v={fmtDate(d.company_establishment_date)}               x={285} y={462} />

        {/* Previous employment (if provided) — placed below main employment block */}
        <F v={d.prev_employer_name}       x={175} y={420} size={8} maxW={275} />
        <F v={d.prev_nature_of_business}  x={175} y={392} size={8} maxW={275} />
        <F v={d.prev_occupation}          x={175} y={364} size={8} maxW={275} />
        {d.prev_length_service && <F v={String(d.prev_length_service)} x={175} y={336} size={8} />}
      </FormPage>

      {/* ════════════ PAGES 5–7 — Secondary, Declaration, Bank use ════════════ */}
      {/* Render blank background pages so the printout is a complete 7-page form */}
      {[5, 6, 7].map(pg => (
        <FormPage key={pg} pageNum={pg} missing={missing(pg)}>
          {/* No data overlay on secondary applicant / declaration / bank-use pages */}
        </FormPage>
      ))}
    </>
  )
}
