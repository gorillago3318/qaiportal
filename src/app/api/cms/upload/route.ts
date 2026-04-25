import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    )
    const adminClient = getAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any).from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const allowed = ['png', 'jpg', 'jpeg', 'svg', 'webp']
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: 'Only PNG, JPG, SVG, and WEBP are allowed' }, { status: 400 })
    }

    const fileName = `logo-${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Ensure bucket exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).storage.createBucket('website-assets', { public: true }).catch(() => { /* already exists */ })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (adminClient as any).storage
      .from('website-assets')
      .upload(`logos/${fileName}`, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: urlData } = (adminClient as any).storage
      .from('website-assets')
      .getPublicUrl(`logos/${fileName}`)

    const publicUrl: string = urlData?.publicUrl || ''

    // Save to CMS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any).from('cms_content').upsert({ key: 'logo_url', value: publicUrl, updated_by: user.id })

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err) {
    console.error('POST /api/cms/upload error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
