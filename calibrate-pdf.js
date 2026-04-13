const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

// Test data matching what agents input
const testData = {
  // Personal Details
  client_title: 'Mr',
  client_name: 'TAN WEI MING',
  client_ic: '900101-10-1234',
  old_ic: 'A1234567',
  passport: '',
  client_dob: '01/01/1990',
  gender: 'Male',
  race: 'Chinese',
  bumiputra: 'No',
  marital_status: 'Married',
  no_of_dependants: '2',
  home_address: 'NO. 123, JALAN BUKIT BINTANG\nTAMAN GOLDEN HILLS\n55100 KUALA LUMPUR',
  post_code: '55100',
  city: 'KUALA LUMPUR',
  state: 'WILAYAH PERSEKUTUAN',
  country: 'MALAYSIA',
  years_at_address: '5',
  contact_number: '012-3456789',
  client_email: 'tanweiming@email.com',
  
  // Employment Details
  employment_type: 'Salaried',
  employer_name: 'ABC SDN BHD',
  nature_of_business: 'INFORMATION TECHNOLOGY',
  occupation: 'SOFTWARE ENGINEER',
  office_address: 'LEVEL 10, MENARA ABC\nJALAN RAJA LAUT\n50350 KUALA LUMPUR',
  office_tel: '03-26123456',
  length_service_years: '5',
  length_service_months: '6',
  monthly_income: '8500',
  
  // Financing Details
  product_type: 'Term Loan',
  purpose: 'Purchase',
  financing_amount: '500000',
  tenure_years: '30',
  interest_rate: '4.25',
  loan_type: 'Conventional',
  
  // Property Details
  property_owner_names: 'TAN WEI MING',
  property_address: 'UNIT A-15-01, CONDOMINIUM SUNWAY\nJALAN PYRAMID\n47500 SUBANG JAYA, SELANGOR',
  property_postcode: '47500',
  property_type: 'Condominium',
  buildup_area: '1200',
  land_area: '',
  purchase_price: '650000',
  type_of_purchase: 'Subsale',
  title_type: 'Strata',
  land_type: 'Leasehold',
  
  // Lawyer
  has_lawyer: true,
  lawyer_name: 'MESSRS. AHMAD & CO',
  law_firm_name: 'AHMAD & CO',
  lawyer_contact: '03-21456789',
  lawyer_email: 'ahmad@lawfirm.com',
  lawyer_address: 'SUITE 5.01, PLAZA XYZ\nJALAN AMPANG\n50450 KUALA LUMPUR',
  
  // Valuer
  has_valuer: true,
  valuer_name: 'ABC VALUERS',
  valuer_firm: 'ABC PROPERTY VALUERS',
  valuer_contact: '03-87654321',
  valuation_fee_quoted: '1500'
}

async function calibratePDF(pdfPath, bankName) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`CALIBRATING: ${bankName}`)
  console.log(`${'='.repeat(80)}\n`)
  
  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  
  console.log(`PDF Dimensions: ${width} x ${height}`)
  console.log(`Total Pages: ${pages.length}\n`)
  
  // Draw grid for reference (every 50 units)
  console.log('Drawing calibration grid...')
  for (let x = 0; x < width; x += 50) {
    firstPage.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    })
    if (x % 100 === 0) {
      firstPage.drawText(x.toString(), { x: x + 2, y: height - 15, size: 7, color: rgb(0.7, 0.7, 0.7) })
    }
  }
  
  for (let y = 0; y < height; y += 50) {
    firstPage.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    })
    if (y % 100 === 0) {
      firstPage.drawText(y.toString(), { x: 5, y: y + 2, size: 7, color: rgb(0.7, 0.7, 0.7) })
    }
  }
  
  // Add coordinate markers at corners
  firstPage.drawRectangle({ x: 0, y: height - 20, width: 20, height: 20, color: rgb(1, 0, 0) })
  firstPage.drawText('(0, TOP)', { x: 25, y: height - 15, size: 8, color: rgb(1, 0, 0) })
  
  firstPage.drawRectangle({ x: 0, y: 0, width: 20, height: 20, color: rgb(0, 0, 1) })
  firstPage.drawText('(0, 0)', { x: 25, y: 5, size: 8, color: rgb(0, 0, 1) })
  
  // Now add test labels at various positions to help identify where fields should go
  console.log('Adding field position markers...\n')
  
  const testPositions = [
    { label: 'TOP LEFT', x: 50, y: height - 50 },
    { label: 'TOP CENTER', x: width / 2, y: height - 50 },
    { label: 'TOP RIGHT', x: width - 150, y: height - 50 },
    { label: 'MIDDLE LEFT', x: 50, y: height / 2 },
    { label: 'MIDDLE CENTER', x: width / 2, y: height / 2 },
    { label: 'MIDDLE RIGHT', x: width - 150, y: height / 2 },
    { label: 'BOTTOM LEFT', x: 50, y: 100 },
    { label: 'BOTTOM CENTER', x: width / 2, y: 100 },
    { label: 'BOTTOM RIGHT', x: width - 150, y: 100 },
  ]
  
  testPositions.forEach(pos => {
    firstPage.drawCircle({ x: pos.x, y: pos.y, size: 5, color: rgb(1, 0, 0) })
    firstPage.drawText(pos.label, { x: pos.x + 10, y: pos.y, size: 9, color: rgb(1, 0, 0), font: helveticaBold })
  })
  
  // Add sample data in common form locations
  console.log('Adding sample data markers...\n')
  
  const sampleFields = [
    { label: 'NAME HERE', x: 150, y: height - 150, bold: true },
    { label: 'IC: 900101-10-1234', x: 150, y: height - 180 },
    { label: 'DOB: 01/01/1990', x: 150, y: height - 210 },
    { label: 'INCOME: RM 8,500.00', x: 150, y: height - 240 },
    { label: 'LOAN: RM 500,000.00', x: 150, y: height - 270 },
    { label: 'PROPERTY ADDR', x: 150, y: height - 300 },
  ]
  
  sampleFields.forEach(field => {
    firstPage.drawText(field.label, {
      x: field.x,
      y: field.y,
      size: 10,
      font: field.bold ? helveticaBold : helveticaFont,
      color: rgb(0, 0, 0.8)
    })
    // Add marker dot
    firstPage.drawCircle({ x: field.x - 5, y: field.y + 3, size: 3, color: rgb(0, 0, 1) })
  })
  
  // Save calibration PDF
  const outputPath = path.join(__dirname, 'Forms', `${bankName}_CALIBRATION.pdf`)
  const pdfBytes_out = await pdfDoc.save()
  fs.writeFileSync(outputPath, pdfBytes_out)
  
  console.log(`✅ Calibration PDF saved to: ${outputPath}`)
  console.log(`\nInstructions:`)
  console.log(`1. Open the calibration PDF`)
  console.log(`2. You'll see a grid with coordinates marked`)
  console.log(`3. Note where form fields are located relative to the grid`)
  console.log(`4. Use those coordinates in FIELD_POSITIONS config`)
  console.log(`5. Red dots show sample text positions\n`)
}

async function main() {
  const formsDir = path.join(__dirname, 'Forms')
  
  // Calibrate HLB
  const hlbPath = path.join(formsDir, 'HONG LEONG BANK APPLICATION FORM.pdf')
  if (fs.existsSync(hlbPath)) {
    await calibratePDF(hlbPath, 'HLB')
  } else {
    console.log('❌ HLB PDF not found')
  }
  
  // Calibrate OCBC
  const ocbcPath = path.join(formsDir, 'OCBC APPLICATION FORM 0225.pdf')
  if (fs.existsSync(ocbcPath)) {
    await calibratePDF(ocbcPath, 'OCBC')
  } else {
    console.log('❌ OCBC PDF not found')
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('CALIBRATION COMPLETE')
  console.log('='.repeat(80))
  console.log('\nNext steps:')
  console.log('1. Open both CALIBRATION.pdf files')
  console.log('2. Measure where each field should be placed')
  console.log('3. Update FIELD_POSITIONS in generate-pdf/route.ts')
  console.log('4. Test with actual case data\n')
}

main()
