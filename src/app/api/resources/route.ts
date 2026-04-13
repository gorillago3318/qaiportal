import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) =>
          c.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any).from('profiles').select('agency_id').eq('id', user.id).single()

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parent_id') // null means root folder

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminClient as any)
      .from('resources')
      .select(`*`)
      .order('is_folder', { ascending: false }) // Folders first
      .order('created_at', { ascending: false })

    if (profile.role !== 'super_admin') {
      // Agents and regular admins see their own agency + global resources (agency IS NULL)
      query = query.or(`agency_id.eq.${profile.agency_id},agency_id.is.null`)
    }

    if (parentId) {
      query = query.eq('parent_id', parentId)
    } else {
      query = query.is('parent_id', null)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/resources error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any).from('profiles').select('role, agency_id').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, category, file_url, file_name, file_type, is_folder, parent_id, agency_id: bodyAgencyId } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const assignedAgencyId = (profile.role === 'super_admin' && bodyAgencyId === 'global') 
      ? null 
      : (profile.role === 'super_admin' && bodyAgencyId) ? bodyAgencyId : profile.agency_id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient as any).from('resources').insert({
      title,
      category: category || 'General',
      is_folder: !!is_folder,
      parent_id: parent_id || null,
      file_url: is_folder ? null : (file_url || null),
      file_name: is_folder ? null : (file_name || 'Document'),
      file_type: is_folder ? null : (file_type || 'application/pdf'),
      created_by: user.id,
      agency_id: assignedAgencyId
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('POST /api/resources error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
