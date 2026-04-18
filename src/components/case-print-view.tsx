'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, X, FileText, Download, Loader2 } from 'lucide-react'
import { HLBFormPreview } from '@/components/hlb-form-preview'

interface CasePrintViewProps {
  caseData: any
  onClose: () => void
  /** Pass the bank config id (e.g. 'hlb') so we can show the correct form template */
  bankId?: string
}

export function CasePrintView({ caseData, onClose, bankId }: CasePrintViewProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // ── HLB: use the dedicated overlay preview ──────────────────────────────────
  if (bankId === 'hong_leong_bank' || bankId === 'hlb') {
    return <HLBFormPreview data={caseData} onClose={onClose} />
  }
  
  const handlePrint = () => {
    window.print()
  }

  const handleDownloadOfficialPDF = async () => {
    try {
      setIsGeneratingPDF(true)
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: caseData.id })
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const data = await response.json()
      
      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = data.filename || `Application_Form_${caseData.case_code || 'draft'}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to generate official PDF form. Please use the Print option instead.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const getBankName = () => {
    switch (caseData.selected_bank) {
      case 'hong_leong_bank':
        return 'Hong Leong Bank Berhad'
      case 'ocbc':
        return 'OCBC Bank (Malaysia) Berhad'
      default:
        return 'Property Loan Application'
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    // If already in DD/MM/YYYY format, return as-is
    if (dateStr.includes('/') && dateStr.length === 10) return dateStr
    // Convert from YYYY-MM-DD to DD/MM/YYYY
    if (dateStr.includes('-') && dateStr.length === 10) {
      const [year, month, day] = dateStr.split('-')
      return `${day}/${month}/${year}`
    }
    return dateStr
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (!amount) return 'N/A'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-auto">
      <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto">
        {/* Print Controls - Hidden when printing */}
        <div className="print:hidden flex justify-between items-center mb-6 sticky top-0 bg-white py-4 border-b shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-[#0A1628]">Application Form Preview</h2>
            <p className="text-sm text-gray-600 mt-1">Review before printing or downloading official form</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleDownloadOfficialPDF} 
              disabled={isGeneratingPDF}
              className="bg-[#0A1628] hover:bg-[#1a2d4a] text-white"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Official Form
                </>
              )}
            </Button>
            <Button onClick={handlePrint} variant="outline" className="border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white">
              <Printer className="w-4 h-4 mr-2" />
              Print Preview
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>

        {/* Printable Content - A4 Format */}
        <div className="printable-content bg-white" style={{ maxWidth: '210mm', margin: '0 auto' }}>
          {/* Header */}
          <div className="text-center border-b-4 border-[#0A1628] pb-6 mb-8">
            <h1 className="text-3xl font-bold uppercase text-[#0A1628] mb-2">Property Loan Application Form</h1>
            <p className="text-xl font-semibold text-[#C9A84C]">{getBankName()}</p>
            <div className="mt-4 pt-4 border-t border-gray-300 grid grid-cols-3 gap-4 text-sm">
              <div><strong>Case Code:</strong> {caseData.case_code || 'DRAFT'}</div>
              <div><strong>Date Generated:</strong> {formatDate(new Date().toISOString().split('T')[0])}</div>
              <div><strong>Status:</strong> {caseData.status || 'Draft'}</div>
            </div>
          </div>

          {/* Section A: Personal Details */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
              SECTION A - PERSONAL DETAILS
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Title:</span>
                <span className="ml-2 font-medium">{caseData.client_title || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Full Name:</span>
                <span className="ml-2 font-medium">{caseData.client_name || caseData.client_full_name || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">NRIC/Passport No:</span>
                <span className="ml-2 font-medium">{caseData.client_ic || caseData.client_ic_number || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Old IC No:</span>
                <span className="ml-2 font-medium">{caseData.old_ic || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Date of Birth:</span>
                <span className="ml-2 font-medium">{formatDate(caseData.client_dob)}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Gender:</span>
                <span className="ml-2 font-medium capitalize">{caseData.gender || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Race:</span>
                <span className="ml-2 font-medium capitalize">{caseData.race || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Marital Status:</span>
                <span className="ml-2 font-medium capitalize">{caseData.marital_status || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Nationality:</span>
                <span className="ml-2 font-medium">{caseData.residency_status || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">No. of Dependants:</span>
                <span className="ml-2 font-medium">{caseData.no_of_dependants || 'N/A'}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Home Address:</span>
                <div className="mt-1 font-medium whitespace-pre-line">{caseData.home_address || 'N/A'}</div>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Postcode:</span>
                <span className="ml-2 font-medium">{caseData.post_code || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">City:</span>
                <span className="ml-2 font-medium">{caseData.city || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">State:</span>
                <span className="ml-2 font-medium capitalize">{caseData.state || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Contact Number:</span>
                <span className="ml-2 font-medium">{caseData.contact_number || 'N/A'}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Email:</span>
                <span className="ml-2 font-medium">{caseData.client_email || 'N/A'}</span>
              </div>
            </div>
          </section>

          {/* Section B: Employment Details */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
              SECTION B - EMPLOYMENT DETAILS
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Employment Type:</span>
                <span className="ml-2 font-medium capitalize">{caseData.employment_type?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Monthly Income:</span>
                <span className="ml-2 font-medium">{formatCurrency(caseData.monthly_income)}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Employer/Business Name:</span>
                <span className="ml-2 font-medium">{caseData.employer_name || 'N/A'}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Nature of Business:</span>
                <span className="ml-2 font-medium">{caseData.nature_of_business || 'N/A'}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Occupation/Position:</span>
                <span className="ml-2 font-medium">{caseData.occupation || 'N/A'}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Office Address:</span>
                <div className="mt-1 font-medium whitespace-pre-line">{caseData.office_address || caseData.employer_address || 'N/A'}</div>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Office Tel:</span>
                <span className="ml-2 font-medium">{caseData.office_tel || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Length of Service:</span>
                <span className="ml-2 font-medium">
                  {caseData.length_service_years || '0'} years {caseData.length_service_months || '0'} months
                </span>
              </div>
            </div>
          </section>

          {/* Section C: Financing Details */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
              SECTION C - FINANCING DETAILS
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Product Type:</span>
                <span className="ml-2 font-medium capitalize">{caseData.product_type || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Purpose:</span>
                <span className="ml-2 font-medium capitalize">{caseData.purpose?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Financing Amount:</span>
                <span className="ml-2 font-medium">{formatCurrency(caseData.financing_amount || caseData.proposed_loan_amount)}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Tenure:</span>
                <span className="ml-2 font-medium">{caseData.tenure_years || 'N/A'} years</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Interest Rate:</span>
                <span className="ml-2 font-medium">{caseData.proposed_interest_rate || 'N/A'}% p.a.</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Loan Type:</span>
                <span className="ml-2 font-medium capitalize">{caseData.loan_type?.replace('_', ' ') || 'N/A'}</span>
              </div>
            </div>
          </section>

          {/* Section D: Property Details */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
              SECTION D - PROPERTY DETAILS
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Property Owner(s):</span>
                <span className="ml-2 font-medium">{caseData.property_owner_names || caseData.client_name || 'N/A'}</span>
              </div>
              <div className="col-span-2 border-b border-gray-200 pb-2">
                <span className="text-gray-600">Property Address:</span>
                <div className="mt-1 font-medium whitespace-pre-line">{caseData.property_address || 'N/A'}</div>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Postcode:</span>
                <span className="ml-2 font-medium">{caseData.property_postcode || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Property Type:</span>
                <span className="ml-2 font-medium capitalize">{caseData.property_type?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Built-up Area:</span>
                <span className="ml-2 font-medium">{caseData.buildup_area || caseData.property_size_buildup || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Land Area:</span>
                <span className="ml-2 font-medium">{caseData.land_area || caseData.property_size_land || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Purchase Price/Market Value:</span>
                <span className="ml-2 font-medium">{formatCurrency(caseData.purchase_price_market_value || caseData.property_value)}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Type of Purchase:</span>
                <span className="ml-2 font-medium capitalize">{caseData.type_of_purchase?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Title Type:</span>
                <span className="ml-2 font-medium capitalize">{caseData.title_type || 'N/A'}</span>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <span className="text-gray-600">Land Tenure:</span>
                <span className="ml-2 font-medium capitalize">{caseData.land_type || caseData.property_tenure || 'N/A'}</span>
              </div>
            </div>
          </section>

          {/* Section E: Lawyer & Valuer Information */}
          {(caseData.has_lawyer === true || caseData.has_valuer === true || caseData.lawyer_name || caseData.valuer_name) && (
            <section className="mb-8">
              <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
                SECTION E - LAWYER & VALUER INFORMATION
              </h2>
              
              {caseData.has_lawyer === true && (
                <div className="mb-6">
                  <h3 className="font-semibold text-[#0A1628] mb-3">Lawyer Details</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Lawyer Name:</span>
                      <span className="ml-2 font-medium">{caseData.lawyer_name || caseData.lawyer_name_other || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Law Firm:</span>
                      <span className="ml-2 font-medium">{caseData.law_firm_name || caseData.lawyer_firm_other || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Contact:</span>
                      <span className="ml-2 font-medium">{caseData.lawyer_contact || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium">{caseData.lawyer_email || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Address:</span>
                      <div className="mt-1 font-medium whitespace-pre-line">{caseData.lawyer_address || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}

              {caseData.has_valuer === true && (
                <div>
                  <h3 className="font-semibold text-[#0A1628] mb-3">Valuer Details</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Valuer Name:</span>
                      <span className="ml-2 font-medium">{caseData.valuer_name || caseData.valuer_1_name || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Valuation Firm:</span>
                      <span className="ml-2 font-medium">{caseData.valuer_firm || caseData.valuer_1_firm || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Contact:</span>
                      <span className="ml-2 font-medium">{caseData.valuer_contact || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Fee Quoted:</span>
                      <span className="ml-2 font-medium">{formatCurrency(caseData.valuer_fee_quoted || caseData.valuer_1_amount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section F: Co-Borrowers */}
          {caseData.co_borrowers && caseData.co_borrowers.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
                SECTION F - CO-BORROWERS / GUARANTORS
              </h2>
              {caseData.co_borrowers.map((borrower: any, index: number) => (
                <div key={index} className="mb-6 pb-6 border-b border-gray-300 last:border-0">
                  <h3 className="font-semibold text-[#0A1628] mb-3">Co-Borrower #{index + 1}</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Full Name:</span>
                      <span className="ml-2 font-medium">{borrower.full_name || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">IC/Passport:</span>
                      <span className="ml-2 font-medium">{borrower.ic_passport || borrower.ic_number || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Relationship:</span>
                      <span className="ml-2 font-medium capitalize">{borrower.relationship || 'N/A'}</span>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Contact:</span>
                      <span className="ml-2 font-medium">{borrower.contact_number || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium">{borrower.email || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Declaration & Signature */}
          <section className="mb-8 mt-12">
            <h2 className="text-xl font-bold text-[#0A1628] border-b-2 border-[#C9A84C] mb-4 pb-2">
              DECLARATION & SIGNATURE
            </h2>
            <div className="text-sm space-y-4">
              <p className="text-justify leading-relaxed">
                I/We hereby declare that the information provided in this application form is true and correct. 
                I/We authorize {getBankName()} to verify the information provided and to obtain credit reports 
                from credit reporting agencies. I/We understand that any false statement may result in the 
                rejection of this application.
              </p>
              
              <div className="grid grid-cols-2 gap-8 mt-8 pt-8">
                <div>
                  <div className="border-b-2 border-black mb-2 h-16"></div>
                  <p className="text-xs text-gray-600">Signature of Applicant</p>
                  <p className="text-sm mt-2">Name: _________________________</p>
                  <p className="text-sm">Date: ____/____/________</p>
                </div>
                <div>
                  <div className="border-b-2 border-black mb-2 h-16"></div>
                  <p className="text-xs text-gray-600">Signature of Joint Applicant (if any)</p>
                  <p className="text-sm mt-2">Name: _________________________</p>
                  <p className="text-sm">Date: ____/____/________</p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t-2 border-gray-300 text-center text-xs text-gray-500">
            <p>This form was generated on {(() => { const n = new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}` })()}</p>
            <p className="mt-1">Case Code: {caseData.case_code || 'DRAFT'} | Status: {caseData.status || 'Draft'}</p>
            <p className="mt-2 italic">Note: This is a computer-generated form. Please review all information carefully before signing.</p>
          </div>
        </div>

        {/* PDF Integration Status */}
        <div className="print:hidden mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">✅ Official Bank Forms Available</h3>
              <p className="text-sm text-green-800 mb-2">
                Official bank application forms are now integrated! Click "Download Official Form" to get 
                the bank's official PDF form with your case data automatically filled in.
              </p>
              <ul className="text-xs text-green-700 space-y-1 ml-4 list-disc">
                <li>Hong Leong Bank Application Form</li>
                <li>OCBC Bank Application Form</li>
                <li>All case data is pre-filled for you</li>
                <li>Ready to print and send to client for signature</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}