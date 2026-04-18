import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Serves the bank application form PDF to the browser so react-pdf can render it
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bank = searchParams.get('bank') || 'hlb'

  const fileName =
    bank === 'hlb' || bank === 'hong_leong_bank'
      ? 'HONG LEONG BANK APPLICATION FORM.pdf'
      : 'OCBC APPLICATION FORM 0225.pdf'

  const filePath = path.join(process.cwd(), 'Forms', fileName)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Form PDF not found' }, { status: 404 })
  }

  const bytes = fs.readFileSync(filePath)

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=86400',
      // Allow browser fetch from same origin
      'Access-Control-Allow-Origin': '*',
    },
  })
}
