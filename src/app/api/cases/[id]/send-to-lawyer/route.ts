import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'

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

/**
 * POST /api/cases/[id]/send-to-lawyer
 * Admin-only. Sends the case document package to the lawyer for LA preparation.
 * Logs the action in bank_form_data.la_preparation_sent and adds a case comment.
 * Emails via Resend if RESEND_API_KEY is configured.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const admin = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Fetch the case with lawyer info
    const { data: caseRow, error: caseErr } = await admin
      .from('cases')
      .select(`
        id, agent_id, status, case_code, bank_form_data,
        lawyer_id,
        proposed_bank:banks!cases_proposed_bank_id_fkey(name),
        client:clients(full_name),
        case_documents(id, document_type, file_name, file_url)
      `)
      .eq('id', id)
      .single()

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    if (caseRow.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Can only send for LA preparation when case is accepted' },
        { status: 422 }
      )
    }

    // Check if already sent
    const existingBfd = (caseRow.bank_form_data as Record<string, unknown>) || {}
    const existingSent = existingBfd.la_preparation_sent as { sent_at: string; sent_by: string } | undefined
    if (existingSent) {
      return NextResponse.json(
        { error: `Already sent on ${existingSent.sent_at}` },
        { status: 422 }
      )
    }

    // Look up lawyer
    let lawyerName = 'Unknown Lawyer'
    let lawyerFirm = ''
    let contactEmail: string | null = null

    if (caseRow.lawyer_id) {
      const { data: lawyer } = await admin
        .from('lawyers')
        .select('name, firm, contact_email')
        .eq('id', caseRow.lawyer_id)
        .single()

      if (lawyer) {
        lawyerName = lawyer.name
        lawyerFirm = lawyer.firm
        contactEmail = lawyer.contact_email
      }
    }

    // Build email body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (caseRow as any).client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bank = (caseRow as any).proposed_bank
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = (caseRow as any).case_documents as { document_type: string; file_url: string; file_name: string }[]

    const docList = docs && docs.length > 0
      ? docs.map((d) => `- ${d.document_type}: ${d.file_url}`).join('\n')
      : '(No documents uploaded yet)'

    const emailSubject = `LA Preparation — ${caseRow.case_code}`
    const emailBody = `Dear ${lawyerName}${lawyerFirm ? ` (${lawyerFirm})` : ''},

Please be informed that the above case is ready for Loan Agreement (LA) preparation.

Case Reference: ${caseRow.case_code}
Client Name: ${client?.full_name ?? '—'}
Bank: ${bank?.name ?? '—'}

The following documents have been uploaded for your reference:
${docList}

Kindly proceed with the LA preparation at your earliest convenience.

Thank you.

QuantifyAI Portal`

    // Attempt email send via Resend
    let emailSent = false
    let emailError: string | null = null

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && contactEmail) {
      try {
        const fromEmail = process.env.EMAIL_FROM || 'cases@quantifyai.my'
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [contactEmail],
            subject: emailSubject,
            text: emailBody,
          }),
        })
        if (!resp.ok) {
          const errBody = await resp.text()
          emailError = `Resend error: ${errBody}`
        } else {
          emailSent = true
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Email send failed'
      }
    } else if (!contactEmail) {
      emailError = 'No contact email for this lawyer — action logged only'
    } else {
      emailError = 'RESEND_API_KEY not configured — action logged only'
    }

    // Save log to bank_form_data
    const logEntry = {
      sent_at: new Date().toISOString(),
      sent_by: user.id,
      sent_by_name: user.email ?? user.id,
      lawyer_id: caseRow.lawyer_id,
      lawyer_name: lawyerName,
      contact_email: contactEmail,
      email_sent: emailSent,
      email_error: emailError,
    }

    const updatedBfd = { ...existingBfd, la_preparation_sent: logEntry }

    await admin
      .from('cases')
      .update({ bank_form_data: updatedBfd })
      .eq('id', id)

    // Add case comment
    const commentText = emailSent
      ? `Documents sent to ${lawyerName} (${lawyerFirm}) for LA preparation.`
      : `LA preparation action logged for ${lawyerName}${lawyerFirm ? ` (${lawyerFirm})` : ''}. ${emailError ? `Note: ${emailError}` : ''}`

    await admin.from('case_comments').insert({
      case_id: id,
      author_id: user.id,
      content: commentText,
      is_admin: true,
    })

    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      email_error: emailError,
      log: logEntry,
    })
  } catch (err) {
    console.error('[send-to-lawyer]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
