import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    // Serve the PDF from the local file (dev) — in production, host on Supabase Storage
    const pdfPath = path.join(
      'C:\\Users\\waiki\\OneDrive\\Desktop\\QuantifyAI',
      'MORTGAGE CONSULTANT AGREEMENT.pdf'
    )
    const fileBuffer = await readFile(pdfPath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Mortgage-Consultant-Agreement.pdf"',
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Agreement file not found. Please contact your administrator.' },
      { status: 404 }
    )
  }
}
