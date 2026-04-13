import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCallerProfile } from '@/lib/supabase/admin'

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: comments, error } = await supabase
      .from('case_comments')
      .select(`
        id,
        case_id,
        content,
        is_admin,
        created_at,
        updated_at,
        author:profiles!case_comments_author_id_fkey(id, full_name, role)
      `)
      .eq('case_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: comments || [] })
  } catch (err) {
    console.error('GET /api/cases/[id]/comments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const { data: comment, error: insertError } = await supabase
      .from('case_comments')
      .insert({
        case_id: id,
        author_id: user.id,
        content: content.trim(),
        is_admin: isAdmin,
      })
      .select(`
        id,
        case_id,
        content,
        is_admin,
        created_at,
        author:profiles!case_comments_author_id_fkey(id, full_name, role)
      `)
      .single()

    if (insertError || !comment) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create comment' }, { status: 500 })
    }

    if (isAdmin) {
      // Fetch case agent_id
      const { data: caseData } = await supabase
        .from('cases')
        .select('agent_id')
        .eq('id', id)
        .single()
        
      if (caseData?.agent_id) {
        await supabase.from('notifications').insert({
          user_id: caseData.agent_id,
          title: 'New Comment',
          message: 'An admin has left a comment on your case.',
          type: 'case_update',
          case_id: id,
        })
      }
    }

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (err) {
    console.error('POST /api/cases/[id]/comments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
