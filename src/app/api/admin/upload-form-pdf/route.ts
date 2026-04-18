import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const BANK_FILE_NAMES: Record<string, string> = {
  hlb:  'HONG LEONG BANK APPLICATION FORM.pdf',
  ocbc: 'OCBC APPLICATION FORM 0225.pdf',
}

// POST /api/admin/upload-form-pdf
// Body: multipart/form-data — fields: bank (string), file (PDF)
// Overwrites the PDF in /Forms/ and returns the file size + timestamp.
export async function POST(request: Request) {
  const formData = await request.formData()
  const bank     = (formData.get('bank') as string | null)?.toLowerCase()
  const file     = formData.get('file') as File | null

  if (!bank || !BANK_FILE_NAMES[bank]) {
    return NextResponse.json({ error: 'Invalid or missing bank' }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }

  const dir      = path.join(process.cwd(), 'Forms')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const fileName = BANK_FILE_NAMES[bank]
  const filePath = path.join(dir, fileName)

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  fs.writeFileSync(filePath, buffer)

  return NextResponse.json({
    success:   true,
    bank,
    fileName,
    size:      buffer.length,
    updatedAt: new Date().toISOString(),
  })
}

// GET /api/admin/upload-form-pdf?bank=hlb
// Returns metadata about the current PDF (exists, size, modified time)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bank = (searchParams.get('bank') || 'hlb').toLowerCase()

  if (!BANK_FILE_NAMES[bank]) {
    return NextResponse.json({ error: 'Unknown bank' }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'Forms', BANK_FILE_NAMES[bank])

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ exists: false, bank })
  }

  const stat = fs.statSync(filePath)
  return NextResponse.json({
    exists:     true,
    bank,
    fileName:   BANK_FILE_NAMES[bank],
    size:       stat.size,
    modifiedAt: stat.mtime.toISOString(),
  })
}
