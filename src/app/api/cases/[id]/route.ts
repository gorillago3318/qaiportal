import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'
import {
  calculateBankCommission,
  calculateLawyerCommission,
  isPanelLawyer,
  getSuperAdminId,
} from '@/lib/commission/engine'

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

    // ── Auto-commission on accepted ──────────────────────────────
    if (newStatus === 'accepted') {
      try {
        const adminClient = getAdminClient()

        // Check no existing commission
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingComm }: { data: any } = await (adminClient as any)
          .from('commissions').select('id').eq('case_id', id).limit(1).maybeSingle()

        if (!existingComm) {
          // Fetch full case data needed for commission
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: fullCase }: { data: any } = await (adminClient as any)
            .from('cases')
            .select('agent_id, agency_id, proposed_loan_amount, proposed_bank_id, bank_form_data, case_code')
            .eq('id', id).single()

          if (fullCase?.proposed_loan_amount && fullCase?.proposed_bank_id) {
            // Fetch bank commission rate
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: bank }: { data: any } = await (adminClient as any)
              .from('banks').select('commission_rate').eq('id', fullCase.proposed_bank_id).single()

            const bankGross = fullCase.proposed_loan_amount * (bank?.commission_rate ?? 0)

            // Load tier config
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: configs }: { data: any } = await (adminClient as any)
              .from('commission_tier_config').select('tier, percentage').eq('agency_id', fullCase.agency_id)
            const configMap: Record<string, number> = {}
            configs?.forEach((c: { tier: string; percentage: number }) => { configMap[c.tier] = c.percentage })

            const superAdminId = await getSuperAdminId(adminClient)
            const bfd = (fullCase.bank_form_data || {}) as Record<string, unknown>
            const lawyerId = (bfd.lawyer_id as string | undefined) || null
            const panelConfirmed = await isPanelLawyer(adminClient, lawyerId)

            const bankResult = await calculateBankCommission({
              caseId: id,
              caseAgentId: fullCase.agent_id,
              agencyId: fullCase.agency_id,
              bankGross,
              adminOverride: 0,
              panelLawyerConfirmed: panelConfirmed,
              adminClient,
              configMap,
              superAdminId,
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminClient as any).from('commissions').insert({
              type: 'bank', case_id: id,
              gross_amount: bankResult.gross,
              discount_amount: bankResult.flatDeduction + bankResult.panelDeduction,
              net_distributable: bankResult.netDistributable,
              company_cut: bankResult.tierBreakdown.breakdown[superAdminId ?? '']?.amount ?? 0,
              tier_breakdown: {
                ...bankResult.tierBreakdown.breakdown,
                _co_broke: bankResult.coBroke.hasCoBroke ? {
                  referrer_agent_id: bankResult.coBroke.referrerAgentId,
                  referrer_amount: bankResult.coBroke.referrerAmount,
                  doer_agent_id: bankResult.coBroke.doerAgentId,
                  doer_pool: bankResult.coBroke.doerPool,
                } : null,
              },
              commission_notes: bankResult.notes,
              status: 'calculated',
            })

            // Lawyer commission if panel + fee present
            const professionalFee = parseFloat(String(bfd.lawyer_professional_fee || '0')) || 0
            if (panelConfirmed && professionalFee > 0) {
              const lwResult = await calculateLawyerCommission({
                caseId: id, caseAgentId: fullCase.agent_id,
                professionalFee, adminClient, configMap, superAdminId,
              })
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (adminClient as any).from('commissions').insert({
                type: 'lawyer', case_id: id,
                gross_amount: lwResult.gross,
                discount_amount: lwResult.companyCut,
                net_distributable: lwResult.netDistributable,
                company_cut: lwResult.tierBreakdown.breakdown[superAdminId ?? '']?.amount ?? 0,
                tier_breakdown: { ...lwResult.tierBreakdown.breakdown },
                commission_notes: lwResult.notes,
                status: 'calculated',
              })
            }

            // Advance case to payment_pending
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminClient as any).from('cases').update({ status: 'payment_pending' }).eq('id', id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminClient as any).from('case_status_history').insert({
              case_id: id, from_status: 'accepted', to_status: 'payment_pending',
              changed_by: user.id, notes: 'Commission auto-calculated on acceptance.',
            })

            // Notify agent
            const agentAmt = bankResult.tierBreakdown.breakdown[fullCase.agent_id]?.amount ?? 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminClient as any).from('notifications').insert({
              user_id: fullCase.agent_id, case_id: id,
              title: 'Commission Calculated',
              message: `Case ${fullCase.case_code}: Bank commission RM${agentAmt.toFixed(2)} calculated. Awaiting payment.`,
            })
          }
        }
      } catch (commErr) {
        // Commission failure must not block the acceptance — log and continue
        console.error('Auto-commission error (non-fatal):', commErr)
      }
    }

    return NextResponse.json({ data: updatedCase })
  } catch (err) {
    console.error('PATCH /api/cases/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
