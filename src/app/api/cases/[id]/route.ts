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

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select(`
        *,
        client:clients(*),
        agent:profiles!cases_agent_id_fkey(id, full_name, agent_code, email, phone, role),
        proposed_bank:banks(id, name, commission_rate)
      `)
      .eq('id', id)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // RLS check for agents
    if (!isAdmin && caseData.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch status history
    const { data: statusHistory } = await supabase
      .from('case_status_history')
      .select(`
        id,
        from_status,
        to_status,
        notes,
        created_at,
        changed_by_profile:profiles!case_status_history_changed_by_fkey(full_name, role)
      `)
      .eq('case_id', id)
      .order('created_at', { ascending: true })

    // Fetch comments
    const { data: comments } = await supabase
      .from('case_comments')
      .select(`
        id,
        content,
        is_admin,
        created_at,
        author:profiles!case_comments_author_id_fkey(full_name, role)
      `)
      .eq('case_id', id)
      .order('created_at', { ascending: true })

    // Fetch documents
    const { data: caseDocuments } = await supabase
      .from('case_documents')
      .select('id, document_type, file_name, file_url, created_at')
      .eq('case_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      data: {
        ...caseData,
        status_history: statusHistory || [],
        comments: comments || [],
        case_documents: caseDocuments || [],
      },
    })
  } catch (err) {
    console.error('GET /api/cases/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
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

    // Fetch current case
    const { data: currentCase, error: fetchError } = await supabase
      .from('cases')
      .select('id, status, agent_id')
      .eq('id', id)
      .single()

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Authorization
    if (!isAdmin && currentCase.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status: newStatus, notes, admin_remarks, new_documents, ...otherFields } = body

    // Build update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {}

    if (isAdmin) {
      if (newStatus !== undefined) updatePayload.status = newStatus
      if (admin_remarks !== undefined) updatePayload.admin_remarks = admin_remarks
      Object.assign(updatePayload, otherFields)
    } else {
      // AGENT LOGIC
      const current = currentCase.status
      
      if (current === 'draft' || current === 'kiv') {
        // Agent can alter data
        Object.assign(updatePayload, otherFields)
        // Allowed transitions
        if (newStatus === 'submitted' || newStatus === 'draft') {
          updatePayload.status = newStatus
        } else if (newStatus !== undefined && newStatus !== current) {
          return NextResponse.json({ error: 'Invalid status transition' }, { status: 403 })
        }
      } else if (current === 'approved') {
        // Agent CANNOT alter data, only accept/reject
        if (Object.keys(otherFields).length > 0) {
          return NextResponse.json({ error: 'Cannot modify case data when approved' }, { status: 403 })
        }
        if (newStatus === 'accepted' || newStatus === 'rejected') {
          updatePayload.status = newStatus
        } else if (newStatus !== undefined && newStatus !== current) {
          return NextResponse.json({ error: 'Invalid status transition' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: `Cannot edit case in ${current} status` }, { status: 403 })
      }
    }

    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Insert new documents
    if (new_documents && Array.isArray(new_documents)) {
      const docsToInsert = new_documents.map((doc: any) => ({
        case_id: id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_url: doc.file_url,
        file_size: doc.file_size,
        uploaded_by: user.id
      }))
      if (docsToInsert.length > 0) {
        await supabase.from('case_documents').insert(docsToInsert)
      }
    }

    // Insert status history if status changed
    if (newStatus && newStatus !== currentCase.status) {
      await supabase.from('case_status_history').insert({
        case_id: id,
        from_status: currentCase.status,
        to_status: newStatus,
        changed_by: user.id,
        notes: notes || null,
      })

      // Notify Agent if Admin changed status
      if (isAdmin && currentCase.agent_id) {
        await supabase.from('notifications').insert({
          user_id: currentCase.agent_id,
          title: 'Case Status Updated',
          message: `Your case has been updated to ${newStatus}.`,
          type: 'case_update',
          case_id: id,
        })
      }
    }

    return NextResponse.json({ data: updatedCase })
  } catch (err) {
    console.error('PATCH /api/cases/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
