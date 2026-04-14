import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("calculations")
      .select("*, proposed_bank:proposed_bank_id(id, name, commission_rate)")
      .eq("id", id)
      .eq("agent_id", user.id)
      .single()

    if (error) {
      console.error("Fetch calculation error:", error)
      return NextResponse.json({ error: "Calculation not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Calculations [id] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from("calculations")
      .select("id, agent_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Calculation not found" }, { status: 404 })
    }
    if (existing.agent_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Only allow updating editable fields (not agent_id, agency_id, converted_to_case_id)
    const allowed = [
      "client_name", "client_ic", "client_phone", "client_dob",
      "current_bank", "current_loan_amount", "current_interest_rate",
      "current_monthly_instalment", "current_tenure_months",
      "proposed_bank_id", "proposed_loan_amount", "proposed_interest_rate",
      "proposed_tenure_months", "has_cash_out", "cash_out_amount", "cash_out_tenure_months",
      "finance_legal_fees", "legal_fee_amount", "valuation_fee_amount", "stamp_duty_amount",
      "results", "referral_code",
    ]

    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key] ?? null
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("calculations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      console.error("Update calculation error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Calculations [id] PATCH error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
