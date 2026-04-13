const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

async function inspectPDF(pdfPath) {
  try {
    console.log(`\n📄 Inspecting: ${path.basename(pdfPath)}\n`)
    
    const pdfBytes = fs.readFileSync(pdfPath)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const form = pdfDoc.getForm()
    const fields = form.getFields()
    
    console.log(`Total Fields: ${fields.length}\n`)
    console.log('Field Names:')
    console.log('─'.repeat(80))
    
    fields.forEach((field, index) => {
      const name = field.getName()
      const type = field.constructor.name
      console.log(`${index + 1}. ${name.padEnd(50)} [${type}]`)
    })
    
    console.log('─'.repeat(80))
    console.log('\n✅ Inspection complete!\n')
    
    return fields.map(f => ({ name: f.getName(), type: f.constructor.name }))
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    return []
  }
}

async function main() {
  const formsDir = path.join(__dirname, 'Forms')
  
  // Inspect HLB form
  const hlbPath = path.join(formsDir, 'HONG LEONG BANK APPLICATION FORM.pdf')
  if (fs.existsSync(hlbPath)) {
    await inspectPDF(hlbPath)
  } else {
    console.log('❌ HLB PDF not found')
  }
  
  // Inspect OCBC form
  const ocbcPath = path.join(formsDir, 'OCBC APPLICATION FORM 0225.pdf')
  if (fs.existsSync(ocbcPath)) {
    await inspectPDF(ocbcPath)
  } else {
    console.log('❌ OCBC PDF not found')
  }
}

main()
