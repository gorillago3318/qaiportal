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

// ── Commission calculation helper ─────────────────────────────────────────────
// Extracted so both auto-calc (on accepted) and admin recalculate share one code path.
async function runCommissionCalculation(
  caseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  /** When true: delete existing commissions and recalculate from scratch. */
  forceRecalc = false,
  /** Notify the agent after calculation (skip on admin-triggered recalc). */
  notifyAgent = true,
): Promise<void> {
  if (forceRecalc) {
    await adminClient.from('commissions').delete().eq('case_id', caseId)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing }: { data: any } = await adminClient
      .from('commissions').select('id').eq('case_id', caseId).limit(1).maybeSingle()
    if (existing) return // already calculated
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fullCase }: { data: any } = await adminClient
    .from('cases')
    .select('agent_id, agency_id, proposed_loan_amount, proposed_bank_id, bank_form_data, case_code, lawyer_id, lawyer_professional_fee')
    .eq('id', caseId)
    .single()

  if (!fullCase) return

  const bfd = (fullCase.bank_form_data || {}) as Record<string, unknown>

  // Fallback: top-level proposed_loan_amount → bank_form_data.total_financing_amount
  const loanAmount = parseFloat(String(fullCase.proposed_loan_amount || bfd.total_financing_amount || '0')) || 0
  if (!loanAmount || !fullCase.proposed_bank_id) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bank }: { data: any } = await adminClient
    .from('banks').select('commission_rate').eq('id', fullCase.proposed_bank_id).single()
  const bankGross = loanAmount * (bank?.commission_rate ?? 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: configs }: { data: any } = await adminClient
    .from('commission_tier_config').select('tier, percentage').eq('agency_id', fullCase.agency_id)
  const configMap: Record<string, number> = {}
  configs?.forEach((c: { tier: string; percentage: number }) => { configMap[c.tier] = c.percentage })

  const superAdminId = await getSuperAdminId(adminClient)

  // Prefer top-level lawyer_id column; fall back to bank_form_data
  const lawyerId = (fullCase.lawyer_id as string | null) || (bfd.lawyer_id as string | undefined) || null
  const panelConfirmed = await isPanelLawyer(adminClient, lawyerId)

  // ── Bank commission ──────────────────────────────────────────────────────────
  const bankResult = await calculateBankCommission({ caseAgentId: fullCase.agent_id, bankGross, adminClient })
  await adminClient.from('commissions').insert({
    type: 'bank', case_id: caseId, agency_id: fullCase.agency_id,
    gross_amount: isFinite(bankResult.gross) ? bankResult.gross : 0,
    discount_amount: isFinite(bankResult.flatDeduction) ? bankResult.flatDeduction : 0,
    net_distributable: isFinite(bankResult.netDistributable) ? bankResult.netDistributable : 0,
    company_cut: 0,
    tier_breakdown: { ...bankResult.tierBreakdown.breakdown },
    commission_notes: bankResult.notes,
    status: 'calculated',
  })

  // ── Lawyer commission (panel + fee required) ─────────────────────────────────
  const professionalFee = parseFloat(String(fullCase.lawyer_professional_fee || bfd.lawyer_professional_fee || '0')) || 0
  if (panelConfirmed && professionalFee > 0) {
    const specialArrangementDiscount = parseFloat(String(bfd.special_arrangement_discount || '0')) || 0
    const lwResult = await calculateLawyerCommission({
      caseId, caseAgentId: fullCase.agent_id,
      professionalFee, panelLawyerConfirmed: panelConfirmed,
      specialArrangementDiscount,
      adminClient, configMap, superAdminId,
    })
    await adminClient.from('commissions').insert({
      type: 'lawyer', case_id: caseId, agency_id: fullCase.agency_id,
      gross_amount: isFinite(lwResult.gross) ? lwResult.gross : 0,
      discount_amount: isFinite(lwResult.companyCut + lwResult.panelDeduction) ? lwResult.companyCut + lwResult.panelDeduction : 0,
      net_distributable: isFinite(lwResult.netDistributable) ? lwResult.netDistributable : 0,
      company_cut: isFinite(lwResult.companyCut) ? lwResult.companyCut : 0,
      tier_breakdown: { ...lwResult.tierBreakdown.breakdown },
      commission_notes: lwResult.notes,
      status: 'calculated',
    })
  }

  // ── Notify agent ─────────────────────────────────────────────────────────────
  if (notifyAgent) {
    const agentAmt = bankResult.tierBreakdown.breakdown[fullCase.agent_id]?.amount ?? 0
    await adminClient.from('notifications').insert({
      user_id: fullCase.agent_id, case_id: caseId,
      title: 'Commission Calculated',
      message: `Case ${fullCase.case_code}: Bank commission RM${agentAmt.toFixed(2)} calculated. Awaiting admin approval for payment.`,
    })
  }
}

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
        proposed_bank:banks(id, name, commission_rate),
        lawyer:lawyers!cases_lawyer_id_fkey(id, name, firm, is_panel)
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

    // Fallback: if lawyer_id FK join returned null (old cases submitted before the
    // top-level lawyer_id column-save fix), try fetching via bank_form_data.lawyer_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvedLawyer = (caseData as any).lawyer ?? null
    if (!resolvedLawyer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bfd = (caseData as any).bank_form_data as Record<string, unknown> | null
      const bfdLawyerId = bfd?.lawyer_id as string | undefined
      if (bfdLawyerId) {
        const adminClient = getAdminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lawyerRow }: { data: any } = await (adminClient as any)
          .from('lawyers')
          .select('id, name, firm, is_panel')
          .eq('id', bfdLawyerId)
          .single()
        if (lawyerRow) resolvedLawyer = lawyerRow
      }
    }

    return NextResponse.json({
      data: {
        ...caseData,
        lawyer: resolvedLawyer,
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
    // recalculate_commission is an admin-only flag — strip it before merging into updatePayload
    const { status: newStatus, notes, admin_remarks, new_documents, recalculate_commission, ...otherFields } = body

    // Use admin client for all DB writes — bypasses RLS, avoids policy rejections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = getAdminClient() as any

    // Build update payload — only safe/known columns allowed at top level
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {}

    if (isAdmin) {
      if (newStatus !== undefined) updatePayload.status = newStatus
      if (admin_remarks !== undefined) updatePayload.admin_remarks = admin_remarks
      // Admins may send arbitrary updates — merge them in
      Object.assign(updatePayload, otherFields)
    } else {
      // AGENT LOGIC
      const current = currentCase.status

      if (current === 'draft' || current === 'kiv') {
        // Agent can alter data — only safe top-level columns + bank_form_data
        const {
          agent_id, loan_type, proposed_bank_id, bank_form_data,
          // Loan-detail columns from buildCasePayload
          proposed_loan_amount, legal_fee_amount, valuation_fee_amount,
          finance_legal_fees, has_cash_out, cash_out_amount,
          current_bank, current_loan_amount, current_monthly_instalment,
          current_interest_rate, current_tenure_months, property_value,
          // Lawyer FK columns from buildCasePayload
          lawyer_id, lawyer_name_other, lawyer_firm_other, lawyer_professional_fee,
        } = otherFields as any
        if (agent_id !== undefined) updatePayload.agent_id = agent_id
        if (loan_type !== undefined) updatePayload.loan_type = loan_type
        if (proposed_bank_id !== undefined) updatePayload.proposed_bank_id = proposed_bank_id
        if (bank_form_data !== undefined) updatePayload.bank_form_data = bank_form_data
        if (proposed_loan_amount !== undefined) updatePayload.proposed_loan_amount = proposed_loan_amount
        if (legal_fee_amount !== undefined) updatePayload.legal_fee_amount = legal_fee_amount
        if (valuation_fee_amount !== undefined) updatePayload.valuation_fee_amount = valuation_fee_amount
        if (finance_legal_fees !== undefined) updatePayload.finance_legal_fees = finance_legal_fees
        if (has_cash_out !== undefined) updatePayload.has_cash_out = has_cash_out
        if (cash_out_amount !== undefined) updatePayload.cash_out_amount = cash_out_amount
        if (current_bank !== undefined) updatePayload.current_bank = current_bank
        if (current_loan_amount !== undefined) updatePayload.current_loan_amount = current_loan_amount
        if (current_monthly_instalment !== undefined) updatePayload.current_monthly_instalment = current_monthly_instalment
        if (current_interest_rate !== undefined) updatePayload.current_interest_rate = current_interest_rate
        if (current_tenure_months !== undefined) updatePayload.current_tenure_months = current_tenure_months
        if (property_value !== undefined) updatePayload.property_value = property_value
        if (lawyer_id !== undefined) updatePayload.lawyer_id = lawyer_id
        if (lawyer_name_other !== undefined) updatePayload.lawyer_name_other = lawyer_name_other
        if (lawyer_firm_other !== undefined) updatePayload.lawyer_firm_other = lawyer_firm_other
        if (lawyer_professional_fee !== undefined) updatePayload.lawyer_professional_fee = lawyer_professional_fee
        // Allowed transitions
        if (newStatus === 'submitted' || newStatus === 'draft') {
          updatePayload.status = newStatus
        } else if (newStatus !== undefined && newStatus !== current) {
          return NextResponse.json({ error: 'Invalid status transition' }, { status: 403 })
        }
      } else if (current === 'approved') {
        // Agent CANNOT alter data, only accept (with LO upload). Reject requires admin.
        if (Object.keys(otherFields).length > 0) {
          return NextResponse.json({ error: 'Cannot modify case data when approved' }, { status: 403 })
        }
        if (newStatus === 'accepted') {
          // Must have Signed Letter of Offer — either just uploaded or already on record
          const hasLoInPayload = Array.isArray(new_documents)
            && new_documents.some((d: any) => d?.document_type === 'Signed Letter of Offer')
          let hasLoOnRecord = false
          if (!hasLoInPayload) {
            const { data: existingLo } = await adminDb
              .from('case_documents')
              .select('id')
              .eq('case_id', id)
              .eq('document_type', 'Signed Letter of Offer')
              .limit(1)
              .maybeSingle()
            hasLoOnRecord = !!existingLo
          }
          if (!hasLoInPayload && !hasLoOnRecord) {
            return NextResponse.json(
              { error: 'Must upload signed Letter of Offer before accepting.' },
              { status: 400 }
            )
          }
          updatePayload.status = newStatus
        } else if (newStatus === 'rejected') {
          return NextResponse.json(
            { error: 'Agents cannot reject an approved case. Please contact admin.' },
            { status: 403 }
          )
        } else if (newStatus !== undefined && newStatus !== current) {
          return NextResponse.json({ error: 'Invalid status transition' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: `Cannot edit case in ${current} status` }, { status: 403 })
      }
    }

    // Use service-role adminDb to bypass RLS for case updates.
    // The trg_cases_status_history trigger has been dropped (migration 022) so
    // there is no longer a risk of auth.uid() returning NULL in a trigger.
    const { data: updatedCase, error: updateError } = await adminDb
      .from('cases')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('PATCH update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Insert new documents (needs service role to bypass storage RLS)
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
        await adminDb.from('case_documents').insert(docsToInsert)
      }
    }

    // The DB trigger trg_cases_status_history was dropped (migration 022) because it used
    // auth.uid() which returns NULL under the service role client. We insert the history
    // row manually here instead.
    if (newStatus && newStatus !== currentCase.status) {
      await adminDb.from('case_status_history').insert({
        case_id: id,
        from_status: currentCase.status,
        to_status: newStatus,
        changed_by: user.id,
        notes: notes || null,
      })

      // Notify Agent if Admin changed status
      if (isAdmin && currentCase.agent_id) {
        await adminDb.from('notifications').insert({
          user_id: currentCase.agent_id,
          title: 'Case Status Updated',
          message: `Your case has been updated to ${newStatus}.`,
          type: 'case_update',
          case_id: id,
        })
      }
    }

    // ── Auto-commission on accepted, or admin-triggered recalculate ─────────────
    const acceptedStatuses = ['accepted', 'pending_execution', 'executed', 'payment_pending', 'paid']
    const finalStatus = (updatedCase as any)?.status || currentCase.status
    const shouldRunCommission =
      newStatus === 'accepted' ||
      (isAdmin && recalculate_commission === true && acceptedStatuses.includes(finalStatus))

    if (shouldRunCommission) {
      try {
        await runCommissionCalculation(
          id,
          getAdminClient(),
          /* forceRecalc */ recalculate_commission === true,
          /* notifyAgent */ newStatus === 'accepted',
        )
      } catch (commErr) {
        // Commission failure must not block the case update — log and continue
        console.error('Auto-commission error (non-fatal):', commErr)
      }
    }

    return NextResponse.json({ data: updatedCase })
  } catch (err) {
    console.error('PATCH /api/cases/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/cases/[id] ───────────────────────────────────────────────────
// Agents:  can only delete their own DRAFT cases
// Admins:  can delete any case regardless of status
export async function DELETE(
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

    // Fetch the case to verify ownership and status
    const { data: caseRow, error: fetchErr } = await supabase
      .from('cases')
      .select('id, agent_id, status, case_code')
      .eq('id', id)
      .single()

    if (fetchErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Permission check
    if (!isAdmin) {
      if (caseRow.agent_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (caseRow.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft cases can be deleted. Contact admin to remove submitted cases.' },
          { status: 403 }
        )
      }
    }

    // Use admin client so RLS does not block cascade deletes
    const adminClient = getAdminClient() as any

    // Delete related records first (in case FK constraints don't cascade)
    await adminClient.from('case_status_history').delete().eq('case_id', id)
    await adminClient.from('case_comments').delete().eq('case_id', id)
    await adminClient.from('co_borrowers').delete().eq('case_id', id)
    await adminClient.from('commissions').delete().eq('case_id', id)
    await adminClient.from('notifications').delete().eq('case_id', id)
    // Unlink any calculation that referenced this case
    await adminClient.from('calculations').update({ case_id: null }).eq('case_id', id)

    // Delete the case itself
    const { error: deleteErr } = await adminClient
      .from('cases')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, case_code: caseRow.case_code })
  } catch (err) {
    console.error('DELETE /api/cases/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
