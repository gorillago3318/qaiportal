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
 * POST /api/cases/[id]/lawyer-quotation
 * Body: {
 *   lawyer_id: string
 *   template_types: ('LA' | 'SPA' | 'MOT')[]
 *   email_subject: string
 *   email_body: string
 * }
 *
 * Sends one email to the lawyer's contact_email and records the request
 * in bank_form_data.lawyer_quotation_requests.
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

    // Fetch the case
    const { data: caseRow, error: caseErr } = await admin
      .from('cases')
      .select('id, agent_id, status, bank_form_data, proposed_bank_id')
      .eq('id', id)
      .single()

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    if (!isAdmin && caseRow.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { lawyer_id, template_types, email_subject, email_body } = await request.json()

    if (!lawyer_id || !template_types?.length || !email_body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch the lawyer's contact_email
    const { data: lawyer, error: lawyerErr } = await admin
      .from('lawyers')
      .select('id, name, firm, contact_email')
      .eq('id', lawyer_id)
      .single()

    if (lawyerErr || !lawyer) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 })
    }

    if (!lawyer.contact_email) {
      return NextResponse.json({ error: 'This lawyer has no contact email set. Please update the lawyer record first.' }, { status: 422 })
    }

    // Send the email via Resend (if API key is configured)
    let emailSent = false
    let emailError: string | null = null

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const fromEmail = process.env.EMAIL_FROM || 'quotations@quantifyai.my'
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [lawyer.contact_email],
            subject: email_subject || `Request for Quotation — ${template_types.join(' + ')}`,
            text: email_body,
          }),
        })
        if (!resp.ok) {
          const errBody = await resp.text()
          emailError = `Resend API error: ${errBody}`
        } else {
          emailSent = true
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Email send failed'
      }
    } else {
      emailError = 'RESEND_API_KEY not configured — email not sent (record saved)'
    }

    // Append the quotation record to bank_form_data
    const existingBfd = (caseRow.bank_form_data as Record<string, unknown>) || {}
    const existingRequests = (existingBfd.lawyer_quotation_requests as unknown[]) || []

    const newRecord = {
      id: crypto.randomUUID(),
      lawyer_id,
      lawyer_name: lawyer.name,
      lawyer_firm: lawyer.firm,
      contact_email: lawyer.contact_email,
      template_types,
      email_subject: email_subject || `Request for Quotation — ${template_types.join(' + ')}`,
      email_body,
      sent_at: new Date().toISOString(),
      email_sent: emailSent,
      email_error: emailError,
      sent_by: user.id,
    }

    const updatedBfd = {
      ...existingBfd,
      lawyer_quotation_requests: [...existingRequests, newRecord],
    }

    const { error: updateErr } = await admin
      .from('cases')
      .update({ bank_form_data: updatedBfd })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      record: newRecord,
      email_sent: emailSent,
      email_error: emailError,
    })
  } catch (err) {
    console.error('Lawyer quotation POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
