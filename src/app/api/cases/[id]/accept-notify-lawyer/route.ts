import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

const CC_EMAIL = 'makwaikit@gmail.com'

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
 * POST /api/cases/[id]/accept-notify-lawyer
 * Called by the case's agent (or admin) after accepting with a panel lawyer.
 * Emails the document package to the lawyer's contact email, CC to QAI.
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
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    // Fetch case with lawyer and document info
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

    // Only agent who owns the case or an admin
    if (!isAdmin && caseRow.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (caseRow.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Case must be in accepted status to notify lawyer' },
        { status: 422 }
      )
    }

    // Lookup lawyer
    if (!caseRow.lawyer_id) {
      return NextResponse.json({ error: 'No lawyer assigned to this case' }, { status: 422 })
    }

    const { data: lawyer } = await admin
      .from('lawyers')
      .select('name, firm, contact_email, is_panel')
      .eq('id', caseRow.lawyer_id)
      .single()

    if (!lawyer?.is_panel) {
      return NextResponse.json({ error: 'Lawyer is not a panel lawyer' }, { status: 422 })
    }

    const contactEmail = lawyer.contact_email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (caseRow as any).client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bank = (caseRow as any).proposed_bank
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = (caseRow as any).case_documents as { document_type: string; file_url: string; file_name: string }[]

    const docList = docs && docs.length > 0
      ? docs.map((d) => `- ${d.document_type}: ${d.file_url}`).join('\n')
      : '(No documents uploaded yet)'

    const emailSubject = `Case Accepted — Document Package — ${caseRow.case_code}`
    const emailBody = `Dear ${lawyer.name}${lawyer.firm ? ` (${lawyer.firm})` : ''},

Please be informed that the above case has been accepted and the document package is ready for your review.

Case Reference: ${caseRow.case_code}
Client Name: ${client?.full_name ?? '—'}
Bank: ${bank?.name ?? '—'}

Documents uploaded:
${docList}

Please proceed with the Loan Agreement preparation at your earliest convenience.

Thank you.

QuantifyAI Portal`

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
            cc: [CC_EMAIL],
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

    // Log in case_comments
    const commentText = emailSent
      ? `Document package sent to ${lawyer.name}${lawyer.firm ? ` (${lawyer.firm})` : ''} at ${contactEmail} (CC: ${CC_EMAIL}).`
      : `Acceptance notification for ${lawyer.name}${lawyer.firm ? ` (${lawyer.firm})` : ''} logged. ${emailError ? `Note: ${emailError}` : ''}`

    await admin.from('case_comments').insert({
      case_id: id,
      author_id: user.id,
      content: commentText,
      is_admin: isAdmin,
    })

    const { data: actorProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
    await logAudit(admin, {
      actorId: user.id,
      actorName: (actorProfile as any)?.full_name ?? 'Unknown',
      actorRole: profile?.role ?? 'agent',
      action: 'lawyer_notified',
      entityType: 'case',
      entityId: id,
      entityLabel: caseRow.case_code,
      metadata: {
        lawyer: lawyer.name,
        firm: lawyer.firm ?? null,
        email: contactEmail ?? null,
        email_sent: emailSent,
      },
    })

    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      email_error: emailError,
      lawyer_email: contactEmail,
      cc_email: CC_EMAIL,
    })
  } catch (err) {
    console.error('[accept-notify-lawyer]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
