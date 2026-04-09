import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const {
      client_name,
      client_ic,
      client_phone,
      client_dob,
      loan_type,
      current_bank,
      current_loan_amount,
      current_interest_rate,
      current_monthly_instalment,
      current_tenure_months,
      proposed_bank_id,
      proposed_loan_amount,
      proposed_interest_rate,
      proposed_tenure_months,
      has_cash_out,
      cash_out_amount,
      cash_out_tenure_months,
      finance_legal_fees,
      legal_fee_amount,
      valuation_fee_amount,
      stamp_duty_amount,
      results,
      referral_code,
    } = body

    // Validate required fields
    if (!client_name || !loan_type) {
      return NextResponse.json(
        { error: "client_name and loan_type are required" },
        { status: 400 }
      )
    }

    const report_token = randomUUID()

    const insertPayload = {
      agent_id: user.id,
      client_name,
      client_ic: client_ic || null,
      client_phone: client_phone || null,
      client_dob: client_dob || null,
      loan_type,
      current_bank: current_bank || null,
      current_loan_amount: current_loan_amount || null,
      current_interest_rate: current_interest_rate || null,
      current_monthly_instalment: current_monthly_instalment || null,
      current_tenure_months: current_tenure_months || null,
      proposed_bank_id: proposed_bank_id || null,
      proposed_loan_amount: proposed_loan_amount || null,
      proposed_interest_rate: proposed_interest_rate || null,
      proposed_tenure_months: proposed_tenure_months || null,
      has_cash_out: has_cash_out ?? false,
      cash_out_amount: cash_out_amount || null,
      cash_out_tenure_months: cash_out_tenure_months || null,
      finance_legal_fees: finance_legal_fees ?? false,
      legal_fee_amount: legal_fee_amount || null,
      valuation_fee_amount: valuation_fee_amount || null,
      stamp_duty_amount: stamp_duty_amount || null,
      results: results || null,
      report_token,
      referral_code: referral_code || null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from("calculations")
      .insert(insertPayload as any)
      .select("id, report_token")
      .single()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const record = data as { id: string; report_token: string | null }
    return NextResponse.json({ id: record.id, report_token: record.report_token }, { status: 201 })
  } catch (err) {
    console.error("Calculations POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("calculations")
      .select(`
        id,
        client_name,
        client_ic,
        loan_type,
        current_bank,
        proposed_bank_id,
        proposed_loan_amount,
        results,
        report_token,
        converted_to_case_id,
        referral_code,
        created_at,
        updated_at
      `)
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase select error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ calculations: data })
  } catch (err) {
    console.error("Calculations GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
