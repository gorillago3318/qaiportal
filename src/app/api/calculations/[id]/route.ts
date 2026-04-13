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
      .select("*")
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
