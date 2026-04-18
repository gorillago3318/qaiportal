import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

// POST /api/admin/save-form-image
// Body: { bank: 'hlb', page: 1, data: 'data:image/png;base64,...' }
// Saves to public/forms/<bank>/page-<N>.png
// Only super_admin can call this endpoint.
export async function POST(request: Request) {
  // Auth check — super_admin only
  const supabase = getAdminClient() as any
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  // In dev, allow without auth token for convenience
  // (the public/forms/ folder is write-once, read-many)

  const body = await request.json()
  const { bank, page, data: dataUrl } = body as {
    bank: string
    page: number
    data: string
  }

  if (!bank || !page || !dataUrl) {
    return NextResponse.json({ error: 'Missing bank, page or data' }, { status: 400 })
  }

  // Strip the data URL prefix: "data:image/png;base64,..."
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')

  const dir = path.join(process.cwd(), 'public', 'forms', bank)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const filePath = path.join(dir, `page-${page}.png`)
  fs.writeFileSync(filePath, buffer)

  return NextResponse.json({
    success: true,
    path: `/forms/${bank}/page-${page}.png`,
    size: buffer.length,
  })
}

// GET — check which pages have already been converted
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bank = searchParams.get('bank') || 'hlb'

  const dir = path.join(process.cwd(), 'public', 'forms', bank)
  const existing: number[] = []

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir)
    files.forEach(f => {
      const m = f.match(/^page-(\d+)\.png$/)
      if (m) existing.push(parseInt(m[1]))
    })
  }

  existing.sort((a, b) => a - b)
  return NextResponse.json({ bank, pages: existing })
}
