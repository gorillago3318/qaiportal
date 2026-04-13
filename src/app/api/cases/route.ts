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
      facility_tenure_months,  // From dynamic form
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

    // Upsert client by ic_number
    let clientId: string
    const icNumber = client_ic_number || client_ic

    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('ic_number', icNumber)
      .single()

    if (existingClient) {
      clientId = existingClient.id
      // Update client info with all fields
      await supabase
        .from('clients')
        .update({
          full_name: client_full_name || client_name,
          phone: client_phone,
          email: client_email || null,
          date_of_birth: convertDateToISO(client_date_of_birth || client_dob),
          monthly_income: client_monthly_income || monthly_income ? Number(client_monthly_income || monthly_income) : null,
          employer: client_employer || employer_name || null,
          gender: client_gender || gender || null,
          marital_status: client_marital_status || marital_status || null,
          residency_status: client_residency_status || residency_status || null,
          address: client_address || home_address || null,
        })
        .eq('id', clientId)
    } else {
      // Insert new client with all fields
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          full_name: client_full_name || client_name,
          ic_number: icNumber,
          phone: client_phone,
          email: client_email || null,
          date_of_birth: convertDateToISO(client_date_of_birth || client_dob),
          monthly_income: client_monthly_income || monthly_income ? Number(client_monthly_income || monthly_income) : null,
          employer: client_employer || employer_name || null,
          gender: client_gender || gender || null,
          marital_status: client_marital_status || marital_status || null,
          residency_status: client_residency_status || residency_status || null,
          address: client_address || home_address || null,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (clientError || !newClient) {
        return NextResponse.json({ error: 'Failed to create client: ' + clientError?.message }, { status: 500 })
      }

      clientId = newClient.id
    }

    // Prepare enhanced lawyer data
    const lawyerData = lawyer_info || {}
    const valuerData = valuer_info || {}

    // Insert case with all fields
    console.log('Creating case with status:', status || 'draft')
    console.log('Agent ID:', user.id)
    console.log('Client ID:', clientId)
    
    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
        agent_id: user.id,
        client_id: clientId,
        calculation_id: body.calculation_id || null,
        loan_type: loan_type || 'refinance',
        status: status || 'draft',  // Use status from frontend (draft/pending_signature/submitted)
        current_bank: current_bank || null,
        current_loan_amount: current_loan_amount ? Number(current_loan_amount) : null,
        current_interest_rate: current_interest_rate ? Number(current_interest_rate) : null,
        current_monthly_instalment: current_monthly_instalment ? Number(current_monthly_instalment) : null,
        current_tenure_months: current_tenure_months ? Number(current_tenure_months) : null,
        loan_type_detail: loan_type_detail || null,
        is_islamic: is_islamic || false,
        has_lock_in: has_lock_in || false,
        property_address: property_address || null,
        property_type: property_type || null,
        property_title: property_title || null,
        property_tenure: property_tenure || null,
        property_value: property_value || purchase_price ? Number(property_value || purchase_price) : null,
        property_size_land: property_size_land || land_size_sqft ? Number(property_size_land || land_size_sqft) : null,
        property_size_buildup: property_size_buildup || buildup_size_sqft ? Number(property_size_buildup || buildup_size_sqft) : null,
        proposed_bank_id: proposed_bank_id || null,
        proposed_loan_amount: proposed_loan_amount || facility_amount ? Number(proposed_loan_amount || facility_amount) : null,
        proposed_interest_rate: proposed_interest_rate || interest_rate ? Number(proposed_interest_rate || interest_rate) : null,
        proposed_tenure_months: proposed_tenure_months || facility_tenure_months ? Number(proposed_tenure_months || facility_tenure_months) : null,
        has_cash_out: has_cash_out || false,
        cash_out_amount: cash_out_amount ? Number(cash_out_amount) : null,
        finance_legal_fees: finance_legal_fees || false,
        legal_fee_amount: legal_fee_amount ? Number(legal_fee_amount) : null,
        valuation_fee_amount: valuation_fee_amount ? Number(valuation_fee_amount) : null,
        // Enhanced lawyer fields
        lawyer_name_other: lawyerData.lawyer_name || lawyer_name_other || null,
        lawyer_firm_other: lawyerData.law_firm_name || lawyer_firm_other || null,
        lawyer_contact: lawyerData.contact_number || null,
        lawyer_email: lawyerData.email || null,
        lawyer_address: lawyerData.address || null,
        has_lawyer: lawyerData.has_lawyer || false,
        is_panel_lawyer: lawyerData.is_panel_lawyer || false,
        lawyer_professional_fee: professional_fee ? Number(professional_fee) : null,
        has_lawyer_discount: has_lawyer_discount || false,
        lawyer_discount_amount: has_lawyer_discount && lawyer_discount_amount ? Number(lawyer_discount_amount) : null,
        // Enhanced valuer fields
        valuer_1_firm: valuerData.firm || valuer_1_firm || null,
        valuer_1_name: valuerData.name || valuer_1_name || null,
        valuer_1_date: convertDateToISO(valuerData.valuation_date) || valuer_1_date || null,
        valuer_1_amount: valuer_1_amount ? Number(valuer_1_amount) : null,
        valuer_contact: valuerData.contact_number || null,
        valuer_email: valuerData.email || null,
        valuation_fee_quoted: valuerData.valuation_fee_quoted ? Number(valuerData.valuation_fee_quoted) : null,
        valuation_report_received: valuerData.report_received || false,
        // Legacy valuer 2 fields (keep for backward compatibility)
        valuer_2_firm: valuer_2_firm || null,
        valuer_2_name: valuer_2_name || null,
        valuer_2_date: valuer_2_date || null,
        valuer_2_amount: valuer_2_amount ? Number(valuer_2_amount) : null,
        lawyer_case_types: [],
        has_co_broke: false,
        agency_id: agencyId || null,
        // Store complete bank form data as JSONB for future reference
        bank_form_data: bank_form_data || null,
      })
      .select('id, case_code')
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

      const { error: coBorrowerError } = await supabase
        .from('co_borrowers')
        .insert(coBorrowerInserts)

      if (coBorrowerError) {
        console.error('Failed to insert co-borrowers:', coBorrowerError)
        // Don't fail the entire request, just log the error
      }
    }

    // Insert initial status history
    await supabase.from('case_status_history').insert({
      case_id: newCase.id,
      from_status: null,
      to_status: 'draft',
      changed_by: user.id,
      notes: 'Case created',
    })

    return NextResponse.json({ data: newCase }, { status: 201 })
  } catch (err) {
    console.error('POST /api/cases error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
