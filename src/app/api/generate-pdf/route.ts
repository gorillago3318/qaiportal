import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

// Field position configuration for each bank
// Calibrated based on standard Malaysian bank form layouts
const FIELD_POSITIONS = {
  hong_leong_bank: {
    // Page 1 - Personal Details (Top section)
    client_title: { x: 85, y: 720 },
    client_name: { x: 130, y: 720 },
    client_ic: { x: 85, y: 695 },
    old_ic: { x: 280, y: 695 },
    client_dob: { x: 85, y: 670 },
    gender: { x: 250, y: 670 },
    race: { x: 350, y: 670 },
    bumiputra: { x: 450, y: 670 },
    marital_status: { x: 85, y: 645 },
    no_of_dependants: { x: 250, y: 645 },
    
    // Contact Information
    home_address: { x: 85, y: 605, maxWidth: 420 },
    post_code: { x: 85, y: 555 },
    city: { x: 180, y: 555 },
    state: { x: 320, y: 555 },
    contact_number: { x: 85, y: 530 },
    client_email: { x: 85, y: 505 },
    
    // Employment Details
    employment_type: { x: 85, y: 465 },
    employer_name: { x: 85, y: 440 },
    nature_of_business: { x: 85, y: 415 },
    occupation: { x: 85, y: 390 },
    office_address: { x: 85, y: 350, maxWidth: 420 },
    office_tel: { x: 85, y: 310 },
    length_service_years: { x: 85, y: 285 },
    monthly_income: { x: 280, y: 285 },
    
    // Financing Details
    product_type: { x: 85, y: 245 },
    purpose: { x: 250, y: 245 },
    financing_amount: { x: 85, y: 220 },
    tenure_years: { x: 250, y: 220 },
    interest_rate: { x: 85, y: 195 },
    loan_type: { x: 250, y: 195 },
    
    // Property Details
    property_owner_names: { x: 85, y: 155 },
    property_address: { x: 85, y: 115, maxWidth: 420 },
    property_postcode: { x: 85, y: 75 },
    property_type: { x: 200, y: 75 },
    buildup_area: { x: 85, y: 50 },
    land_area: { x: 250, y: 50 },
    purchase_price: { x: 85, y: 25 },
  },
  ocbc: {
    // OCBC form has different layout - typically wider format
    // Page 1 - Personal Details
    client_title: { x: 95, y: 520 },
    client_name: { x: 145, y: 520 },
    client_ic: { x: 95, y: 495 },
    old_ic: { x: 300, y: 495 },
    client_dob: { x: 95, y: 470 },
    gender: { x: 260, y: 470 },
    race: { x: 360, y: 470 },
    bumiputra: { x: 460, y: 470 },
    marital_status: { x: 95, y: 445 },
    no_of_dependants: { x: 260, y: 445 },
    
    // Contact Information
    home_address: { x: 95, y: 405, maxWidth: 450 },
    post_code: { x: 95, y: 355 },
    city: { x: 190, y: 355 },
    state: { x: 330, y: 355 },
    contact_number: { x: 95, y: 330 },
    client_email: { x: 95, y: 305 },
    
    // Employment Details
    employment_type: { x: 95, y: 265 },
    employer_name: { x: 95, y: 240 },
    nature_of_business: { x: 95, y: 215 },
    occupation: { x: 95, y: 190 },
    office_address: { x: 95, y: 150, maxWidth: 450 },
    office_tel: { x: 95, y: 110 },
    length_service_years: { x: 95, y: 85 },
    monthly_income: { x: 290, y: 85 },
    
    // Financing Details
    product_type: { x: 95, y: 45 },
    purpose: { x: 260, y: 45 },
    financing_amount: { x: 95, y: 20 },
    tenure_years: { x: 260, y: 20 },
    interest_rate: { x: 430, y: 20 },
    loan_type: { x: 95, y: -5 }, // May need page 2
    
    // Property Details (likely on page 2)
    property_owner_names: { x: 95, y: 520 },
    property_address: { x: 95, y: 480, maxWidth: 450 },
    property_postcode: { x: 95, y: 440 },
    property_type: { x: 210, y: 440 },
    buildup_area: { x: 95, y: 415 },
    land_area: { x: 260, y: 415 },
    purchase_price: { x: 95, y: 390 },
  }
}

export async function POST(request: Request) {
  try {
    const { caseId } = await request.json()
    
    if (!caseId) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    // Get case data from database
    const supabase = await createClient()
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Type assertion to access dynamic fields
    // Form data is stored in bank_form_data JSONB column; fall back to top-level for legacy rows
    const raw = caseData as any
    const data = { ...raw, ...(raw.bank_form_data || {}) }

    // Determine which bank form to use
    const bankType = data.selected_bank === 'hong_leong_bank' ? 'hong_leong_bank' : 'ocbc'
    const bankFormPath = bankType === 'hong_leong_bank'
      ? path.join(process.cwd(), 'Forms', 'HLB_CALIBRATION.pdf')
      : path.join(process.cwd(), 'Forms', 'OCBC APPLICATION FORM 0225.pdf')

    // Check if form file exists
    if (!fs.existsSync(bankFormPath)) {
      return NextResponse.json({ 
        error: 'Bank form template not found',
        path: bankFormPath
      }, { status: 404 })
    }

    // Load the existing PDF
    const existingPdfBytes = fs.readFileSync(bankFormPath)
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    
    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    // Get pages
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const secondPage = pages.length > 1 ? pages[1] : null
    
    // Helper functions
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return ''
      if (dateStr.includes('/') && dateStr.length === 10) return dateStr
      if (dateStr.includes('-') && dateStr.length === 10) {
        const [year, month, day] = dateStr.split('-')
        return `${day}/${month}/${year}`
      }
      return dateStr
    }

    const formatCurrency = (amount: number | string | null | undefined) => {
      if (!amount) return ''
      const num = typeof amount === 'string' ? parseFloat(amount) : amount
      return num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    // Draw text at configured position
    const drawFieldText = (fieldName: string, value: string | null | undefined, options: any = {}) => {
      if (!value) return
      
      const positions = FIELD_POSITIONS[bankType as keyof typeof FIELD_POSITIONS]
      const pos = positions[fieldName as keyof typeof positions] as any
      
      if (!pos) {
        console.warn(`Position not configured for field: ${fieldName}`)
        return
      }
      
      // Determine which page to draw on (negative Y means page 2)
      const targetPage = pos.y < 0 ? secondPage : firstPage
      if (!targetPage) return
      
      const adjustedY = pos.y < 0 ? pos.y + 600 : pos.y // Adjust for page 2
      
      const drawOptions: any = {
        x: pos.x,
        y: adjustedY,
        size: options.size || 10,
        font: options.bold ? helveticaBold : helveticaFont,
        color: options.color || rgb(0, 0, 0),
      }
      
      if (pos.maxWidth) {
        drawOptions.maxWidth = pos.maxWidth
      }
      
      targetPage.drawText(value.toString(), drawOptions)
    }

    // Fill all fields based on configuration
    const positions = FIELD_POSITIONS[bankType as keyof typeof FIELD_POSITIONS]
    
    // Personal Details
    drawFieldText('client_title', data.client_title)
    drawFieldText('client_name', data.client_name || data.client_full_name, { bold: true, size: 11 })
    drawFieldText('client_ic', data.client_ic || data.client_ic_number)
    drawFieldText('old_ic', data.old_ic || data.client_old_ic)
    drawFieldText('client_dob', formatDate(data.client_dob || data.client_date_of_birth))
    drawFieldText('gender', data.gender?.toUpperCase())
    drawFieldText('race', data.race?.toUpperCase())
    drawFieldText('bumiputra', data.bumiputra)
    drawFieldText('marital_status', data.marital_status)
    drawFieldText('no_of_dependants', data.no_of_dependants?.toString())
    
    // Contact Information
    drawFieldText('home_address', data.home_address)
    drawFieldText('post_code', data.post_code)
    drawFieldText('city', data.city)
    drawFieldText('state', data.state?.toUpperCase())
    drawFieldText('contact_number', data.contact_number || data.client_phone)
    drawFieldText('client_email', data.client_email)
    
    // Employment Details
    drawFieldText('employment_type', data.employment_type)
    drawFieldText('employer_name', data.employer_name)
    drawFieldText('nature_of_business', data.nature_of_business)
    drawFieldText('occupation', data.occupation)
    drawFieldText('office_address', data.office_address)
    drawFieldText('office_tel', data.office_tel)
    drawFieldText('length_service_years', data.length_service_years ? `${data.length_service_years}y ${data.length_service_months || 0}m` : '')
    drawFieldText('monthly_income', formatCurrency(data.monthly_income || data.client_monthly_income), { bold: true })
    
    // Financing Details
    drawFieldText('product_type', data.product_type)
    drawFieldText('purpose', data.purpose)
    drawFieldText('financing_amount', formatCurrency(data.financing_amount || data.proposed_loan_amount), { bold: true, size: 11 })
    drawFieldText('tenure_years', data.tenure_years ? `${data.tenure_years} years` : '')
    drawFieldText('interest_rate', data.proposed_interest_rate ? `${data.proposed_interest_rate}% p.a.` : '')
    drawFieldText('loan_type', data.loan_type)
    
    // Property Details
    drawFieldText('property_owner_names', data.property_owner_names || data.client_name)
    drawFieldText('property_address', data.property_address)
    drawFieldText('property_postcode', data.property_postcode)
    drawFieldText('property_type', data.property_type)
    drawFieldText('buildup_area', data.buildup_area || data.property_size_buildup?.toString())
    drawFieldText('land_area', data.land_area || data.property_size_land?.toString())
    drawFieldText('purchase_price', formatCurrency(data.purchase_price_market_value || data.property_value), { bold: true })
    drawFieldText('type_of_purchase', data.type_of_purchase)
    drawFieldText('title_type', data.title_type)
    drawFieldText('land_type', data.land_type || data.property_tenure)

    // Lawyer Information (if applicable)
    if (data.has_lawyer) {
      drawFieldText('lawyer_name', data.lawyer_name || data.lawyer_name_other)
      drawFieldText('law_firm_name', data.law_firm_name || data.lawyer_firm_other)
      drawFieldText('lawyer_contact', data.lawyer_contact)
      drawFieldText('lawyer_email', data.lawyer_email)
      drawFieldText('lawyer_address', data.lawyer_address)
    }

    // Valuer Information (if applicable)
    if (data.has_valuer) {
      drawFieldText('valuer_name', data.valuer_name || data.valuer_1_name)
      drawFieldText('valuer_firm', data.valuer_firm || data.valuer_1_firm)
      drawFieldText('valuer_contact', data.valuer_contact)
      drawFieldText('valuation_fee_quoted', formatCurrency(data.valuer_fee_quoted || data.valuer_1_amount))
    }

    // Add timestamp and case info
    const lastPage = pages[pages.length - 1]
    lastPage.drawText(`Case Code: ${data.case_code || 'DRAFT'}`, { x: 50, y: 40, size: 8, color: rgb(0.4, 0.4, 0.4) })
    lastPage.drawText(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, { x: 50, y: 30, size: 8, color: rgb(0.4, 0.4, 0.4) })

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save()
    
    // Convert to base64 for sending to client
    const base64Pdf = Buffer.from(pdfBytes).toString('base64')
    
    return NextResponse.json({
      success: true,
      pdf: base64Pdf,
      filename: `Application_Form_${data.case_code || caseId}.pdf`,
      note: 'PDF filled with calibrated positions. Review and adjust FIELD_POSITIONS if needed.'
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
