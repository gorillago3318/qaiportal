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

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const loanType = searchParams.get('loan_type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_code,
        loan_type,
        status,
        current_bank,
        current_loan_amount,
        proposed_loan_amount,
        proposed_interest_rate,
        proposed_tenure_months,
        has_cash_out,
        cash_out_amount,
        finance_legal_fees,
        property_address,
        property_value,
        is_islamic,
        has_lock_in,
        admin_remarks,
        created_at,
        updated_at,
        client:clients(id, full_name, ic_number, phone, email),
        agent:profiles!cases_agent_id_fkey(id, full_name, agent_code, email, phone)
      `, { count: 'exact' })

    if (!isAdmin) {
      query = query.eq('agent_id', user.id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    if (search) {
      // Search by case_code or client full_name - we do client name search via join
      query = query.or(`case_code.ilike.%${search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Cases fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If search, also filter by client name (post-filter since join filter is complex)
    let filtered = data || []
    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = filtered.filter((c) => {
        const clientName = (c.client as { full_name?: string } | null)?.full_name?.toLowerCase() || ''
        const caseCode = c.case_code?.toLowerCase() || ''
        return clientName.includes(lowerSearch) || caseCode.includes(lowerSearch)
      })
    }

    return NextResponse.json({ data: filtered, count, page, limit })
  } catch (err) {
    console.error('GET /api/cases error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get agent's agency_id
    const agentProfile = await getCallerProfile(user.id)
    const agencyId = agentProfile?.agency_id

    // Admin client bypasses RLS for all DB writes in this handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = getAdminClient() as any

    const body = await request.json()

    const {
      // Client fields (from dynamic forms - may use different field names)
      client_full_name,
      client_name,  // From dynamic form
      client_ic_number,
      client_ic,  // From dynamic form
      client_phone,
      client_email,
      client_date_of_birth,
      client_dob,  // From dynamic form (DD/MM/YYYY format)
      client_monthly_income,
      monthly_income,  // From dynamic form
      client_employer,
      employer_name,  // From dynamic form
      client_gender,
      gender,  // From dynamic form
      client_marital_status,
      marital_status,  // From dynamic form
      client_residency_status,
      residency_status,  // From dynamic form
      client_address,
      home_address,  // From dynamic form
      post_code,
      city,
      state,
      country,
      employment_type,
      nature_of_business,
      occupation,
      length_service_years,
      length_service_months,
      company_establishment_date,
      // Case fields
      loan_type,
      current_bank,
      current_loan_amount,
      current_interest_rate,
      current_monthly_instalment,
      current_tenure_months,
      loan_type_detail,
      is_islamic,
      has_lock_in,
      property_address,
      property_type,
      property_title,
      property_tenure,
      property_value,
      purchase_price,  // From dynamic form
      property_size_land,
      land_size_sqft,  // From dynamic form
      property_size_buildup,
      buildup_size_sqft,  // From dynamic form
      proposed_bank_id,
      selected_bank,  // From dynamic form
      proposed_loan_amount,
      facility_amount,  // From dynamic form
      proposed_interest_rate,
      interest_rate,  // From dynamic form
      proposed_tenure_months,
      facility_tenure_months,  // HLB dynamic form (months)
      tenure_years,             // OCBC dynamic form (years)
      has_cash_out,
      cash_out_amount,
      finance_legal_fees,
      legal_fee_amount,
      valuation_fee_amount,
      lawyer_name_other,
      lawyer_firm_other,
      has_lawyer_discount,
      lawyer_discount_amount,
      professional_fee,
      valuer_1_firm,
      valuer_1_name,
      valuer_1_date,
      valuer_1_amount,
      valuer_2_firm,
      valuer_2_name,
      valuer_2_date,
      valuer_2_amount,
      co_borrowers,
      // Enhanced lawyer/valuer info (from new interface)
      lawyer_info,
      valuer_info,
      // Bank-specific form data (store as JSONB)
      bank_form_data,
      // Status from frontend
      status,
    } = body
    // Note: body.client_id is read directly (not destructured) below in the client-upsert logic

    // Helper to convert DD/MM/YYYY to YYYY-MM-DD for database
    const convertDateToISO = (dateStr: string | null | undefined): string | null => {
      if (!dateStr) return null
      // If already in ISO format, return as-is
      if (dateStr.includes('-') && dateStr.length === 10) return dateStr
      // Convert DD/MM/YYYY to YYYY-MM-DD
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        const [day, month, year] = parts
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      return null
    }

    // ── Resolve client ID ──────────────────────────────────────────────────────
    // Priority: (1) client_id already in body (pre-created by frontend upsertClient)
    //           (2) look up by IC from body or bank_form_data
    //           (3) create with whatever we have, using placeholder name if needed

    // Pull client fields from bank_form_data as fallback (buildCasePayload puts them there)
    const bfd = (bank_form_data as Record<string, unknown>) || {}
    const resolvedName    = client_full_name || client_name || (bfd.client_name as string) || null
    const resolvedIc      = client_ic_number || client_ic   || (bfd.client_ic as string)   || null
    const resolvedPhone   = client_phone     || (bfd.client_phone as string)                || ''
    const resolvedEmail   = client_email     || (bfd.client_email as string)                || null
    const resolvedDob     = convertDateToISO(client_date_of_birth || client_dob || (bfd.client_dob as string))
    const resolvedIncome  = client_monthly_income || monthly_income || (bfd.monthly_income as string) || null
    const resolvedEmployer = client_employer || employer_name || (bfd.employer_name as string) || null
    const resolvedGender  = client_gender  || gender  || (bfd.gender as string)  || null
    const resolvedMarital = client_marital_status || marital_status || (bfd.marital_status as string) || null
    const resolvedAddress = client_address || home_address || (bfd.home_address as string) || null

    let clientId: string

    // (1) Frontend already created / found a client — trust it
    if (body.client_id) {
      clientId = body.client_id
      // Optionally update the client if we now have more info
      if (resolvedName) {
        await adminDb.from('clients').update({
          full_name: resolvedName,
          phone: resolvedPhone || undefined,
          email: resolvedEmail,
          date_of_birth: resolvedDob,
          monthly_income: resolvedIncome ? Number(resolvedIncome) : null,
          employer: resolvedEmployer,
          gender: resolvedGender,
          marital_status: resolvedMarital,
          address: resolvedAddress,
        }).eq('id', clientId)
      }
    } else if (resolvedIc) {
      // (2) Try to find existing client by IC number
      const { data: existingClient } = await adminDb
        .from('clients')
        .select('id')
        .eq('ic_number', resolvedIc)
        .maybeSingle()

      if (existingClient) {
        clientId = existingClient.id
        if (resolvedName) {
          await adminDb.from('clients').update({
            full_name: resolvedName,
            phone: resolvedPhone || undefined,
            email: resolvedEmail,
            date_of_birth: resolvedDob,
            monthly_income: resolvedIncome ? Number(resolvedIncome) : null,
            employer: resolvedEmployer,
            gender: resolvedGender,
            marital_status: resolvedMarital,
            address: resolvedAddress,
          }).eq('id', clientId)
        }
      } else {
        // Create new client — use placeholder name if not yet entered (draft stage)
        const { data: newClient, error: clientError } = await adminDb
          .from('clients')
          .insert({
            full_name: resolvedName || 'Draft Client',
            ic_number: resolvedIc,
            phone: resolvedPhone,
            email: resolvedEmail,
            date_of_birth: resolvedDob,
            monthly_income: resolvedIncome ? Number(resolvedIncome) : null,
            employer: resolvedEmployer,
            gender: resolvedGender,
            marital_status: resolvedMarital,
            address: resolvedAddress,
            created_by: user.id,
          })
          .select('id')
          .single()

        if (clientError || !newClient) {
          return NextResponse.json({ error: 'Failed to create client: ' + clientError?.message }, { status: 500 })
        }
        clientId = newClient.id
      }
    } else {
      // (3) No IC and no existing client_id — create a bare placeholder so the draft can be saved
      const { data: placeholderClient, error: placeholderErr } = await adminDb
        .from('clients')
        .insert({
          full_name: resolvedName || 'Draft Client',
          ic_number: `DRAFT-${user.id.slice(0, 8)}-${Date.now()}`, // unique placeholder
          phone: resolvedPhone,
          email: resolvedEmail,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (placeholderErr || !placeholderClient) {
        return NextResponse.json({ error: 'Failed to create placeholder client: ' + placeholderErr?.message }, { status: 500 })
      }
      clientId = placeholderClient.id
    }

    // Merge all extra fields into bank_form_data so nothing is lost
    // (avoids "column not found" errors for fields that may not exist in the live DB)
    const mergedBfd = {
      ...(bank_form_data as Record<string, unknown> || {}),
      // valuer detail fields stored here (not as individual columns)
      valuer_1_firm: valuer_1_firm || null,
      valuer_1_name: valuer_1_name || null,
      valuer_1_date: valuer_1_date || null,
      valuer_1_amount: valuer_1_amount || null,
      valuer_2_firm: valuer_2_firm || null,
      valuer_2_name: valuer_2_name || null,
      valuer_2_date: valuer_2_date || null,
      valuer_2_amount: valuer_2_amount || null,
      // lawyer detail fields
      lawyer_name_other: lawyer_name_other || null,
      lawyer_firm_other: lawyer_firm_other || null,
      lawyer_professional_fee: professional_fee || null,
      has_lawyer_discount: has_lawyer_discount || false,
      lawyer_discount_amount: lawyer_discount_amount || null,
    }

    // Insert case — only columns confirmed to exist in the live DB schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCase, error: caseError } = await (adminDb as any)
      .from('cases')
      .insert({
        agent_id: user.id,
        client_id: clientId,
        agency_id: agencyId || null,
        calculation_id: body.calculation_id || null,
        loan_type: loan_type || 'refinance',
        status: status || 'draft',
        current_bank: current_bank || null,
        current_loan_amount: current_loan_amount ? Number(current_loan_amount) : null,
        current_interest_rate: current_interest_rate ? Number(current_interest_rate) : null,
        current_monthly_instalment: current_monthly_instalment ? Number(current_monthly_instalment) : null,
        current_tenure_months: current_tenure_months ? Number(current_tenure_months) : null,
        loan_type_detail: loan_type_detail || null,
        is_islamic: is_islamic || false,
        has_lock_in: has_lock_in || false,
        property_address: property_address || (bfd.property_address as string) || null,
        property_type: property_type || (bfd.property_type as string) || null,
        property_value: (property_value || purchase_price) ? Number(property_value || purchase_price) : null,
        proposed_bank_id: proposed_bank_id || (bfd.proposed_bank_db_id as string) || null,
        proposed_loan_amount: (proposed_loan_amount || facility_amount) ? Number(proposed_loan_amount || facility_amount) : null,
        proposed_interest_rate: (proposed_interest_rate || interest_rate) ? Number(proposed_interest_rate || interest_rate) : null,
        proposed_tenure_months: (() => {
          if (proposed_tenure_months) return Number(proposed_tenure_months)
          if (facility_tenure_months) return Number(facility_tenure_months)
          if (tenure_years) return Number(tenure_years) * 12
          return null
        })(),
        has_cash_out: has_cash_out || false,
        cash_out_amount: cash_out_amount ? Number(cash_out_amount) : null,
        finance_legal_fees: finance_legal_fees || false,
        legal_fee_amount: legal_fee_amount ? Number(legal_fee_amount) : null,
        valuation_fee_amount: valuation_fee_amount ? Number(valuation_fee_amount) : null,
        lawyer_case_types: [],
        has_co_broke: false,
        // Everything else lives in bank_form_data JSONB
        bank_form_data: mergedBfd,
      })
      .select('id, case_code, status, bank_form_data')
      .single()

    if (caseError) {
      console.error('Database insert error:', caseError)
      console.error('Error details:', JSON.stringify(caseError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to create case',
        details: caseError.message,
        hint: caseError.hint 
      }, { status: 500 })
    }
    
    if (!newCase) {
      console.error('No case returned after insert')
      return NextResponse.json({ error: 'Failed to create case: No data returned' }, { status: 500 })
    }
    
    console.log('Case created successfully:', newCase.id, newCase.case_code)

    // Insert co-borrowers if any
    if (co_borrowers && Array.isArray(co_borrowers) && co_borrowers.length > 0) {
      const coBorrowerInserts = co_borrowers.map((cb: any) => ({
        case_id: newCase.id,
        full_name: cb.full_name,
        ic_number: cb.ic_number,
        phone: cb.phone || null,
        email: cb.email || null,
        date_of_birth: cb.date_of_birth || null,
        employer: cb.employer || null,
        monthly_income: cb.monthly_income ? Number(cb.monthly_income) : null,
        relationship: cb.relationship || null,
        role: cb.role || 'co_borrower',
      }))

      const { error: coBorrowerError } = await adminDb
        .from('co_borrowers')
        .insert(coBorrowerInserts)

      if (coBorrowerError) {
        console.error('Failed to insert co-borrowers:', coBorrowerError)
        // Don't fail the entire request, just log the error
      }
    }

    // Insert initial status history
    await adminDb.from('case_status_history').insert({
      case_id: newCase.id,
      from_status: null,
      to_status: status || 'draft',
      changed_by: user.id,
      notes: 'Case created',
    })

    return NextResponse.json({ data: newCase }, { status: 201 })
  } catch (err) {
    console.error('POST /api/cases error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
