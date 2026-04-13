import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bank = searchParams.get('bank') || 'hong_leong_bank'
    
    const bankFormPath = bank === 'hong_leong_bank'
      ? path.join(process.cwd(), 'Forms', 'HONG LEONG BANK APPLICATION FORM.pdf')
      : path.join(process.cwd(), 'Forms', 'OCBC APPLICATION FORM 0225.pdf')

    if (!fs.existsSync(bankFormPath)) {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 })
    }

    const existingPdfBytes = fs.readFileSync(bankFormPath)
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const form = pdfDoc.getForm()
    
    // Get all form fields
    const fields = form.getFields()
    const fieldInfo = fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name,
    }))

    return NextResponse.json({
      bank,
      totalFields: fields.length,
      fields: fieldInfo
    })

  } catch (error) {
    console.error('Error inspecting PDF:', error)
    return NextResponse.json({ 
      error: 'Failed to inspect PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
