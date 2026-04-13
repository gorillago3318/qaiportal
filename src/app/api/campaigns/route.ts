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

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any).from('profiles').select('role, agency_id').eq('id', user.id).single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminClient as any)
      .from('campaigns')
      .select(`
        id, title, body, image_url, target_roles, is_published, published_at, expires_at, created_at,
        target_type, target_value, target_bank_id, target_requires_panel_lawyer, target_start_date, target_end_date,
        created_by:profiles!campaigns_created_by_fkey(full_name),
        campaign_reads(user_id)
      `)
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      // Agents only see published, unexpired campaigns targeting their role and agency
      query = query
        .eq('is_published', true)
        .eq('agency_id', profile.agency_id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .contains('target_roles', [profile.role])
    } else {
      query = query.eq('agency_id', profile.agency_id)
    }

    const { data: campaigns, error } = await query
    if (error) throw error

    // Determine agent progress if not admin
    if (!isAdmin && campaigns?.length > 0) {
      // Use cases submitted by this agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: agentCases } = await (adminClient as any)
        .from('cases')
        .select('created_at, proposed_loan_amount, proposed_bank_id, used_panel_lawyer')
        .eq('agent_id', user.id)

      for (const campaign of campaigns) {
        if (!campaign.target_type || !campaign.target_value) continue

        let progressValue = 0
        const validCases = (agentCases || []).filter((c: any) => {
          const caseDate = new Date(c.created_at).getTime()
          const startMatches = !campaign.target_start_date || caseDate >= new Date(campaign.target_start_date).getTime()
          const endMatches = !campaign.target_end_date || caseDate <= new Date(campaign.target_end_date).getTime()
          const bankMatches = !campaign.target_bank_id || c.proposed_bank_id === campaign.target_bank_id
          const lawyerMatches = !campaign.target_requires_panel_lawyer || c.used_panel_lawyer === true

          return startMatches && endMatches && bankMatches && lawyerMatches
        })

        if (campaign.target_type === 'cases') {
          progressValue = validCases.length
        } else if (campaign.target_type === 'volume') {
          progressValue = validCases.reduce((sum: number, c: any) => sum + (c.proposed_loan_amount || 0), 0)
        }

        campaign.agent_progress = progressValue
      }
    }

    return NextResponse.json({ 
      data: campaigns, 
      current_user_id: user.id 
    })
  } catch (err) {
    console.error('GET /api/campaigns error:', err)
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
    const { 
      title, body: contentText, target_roles, is_published,
      target_type, target_value, target_bank_id, target_requires_panel_lawyer, target_start_date, target_end_date 
    } = body

    if (!title || !contentText) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient as any).from('campaigns').insert({
      title,
      body: contentText,
      target_roles: target_roles || ['agent', 'senior_agent', 'unit_manager', 'agency_manager'],
      is_published: !!is_published,
      published_at: is_published ? new Date().toISOString() : null,
      created_by: user.id,
      agency_id: profile.agency_id,
      target_type: target_type || null,
      target_value: target_value ? parseFloat(target_value) : null,
      target_bank_id: target_bank_id || null,
      target_requires_panel_lawyer: !!target_requires_panel_lawyer,
      target_start_date: target_start_date || null,
      target_end_date: target_end_date || null
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('POST /api/campaigns error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
