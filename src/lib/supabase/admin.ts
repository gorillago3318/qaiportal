import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS, use only in API routes for trusted operations
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type CallerProfile = {
  role: string
  agency_id: string | null
}

// Fetch caller's profile using service role — always works regardless of RLS state
export async function getCallerProfile(userId: string): Promise<CallerProfile | null> {
  const adminClient = getAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any)
    .from('profiles')
    .select('role, agency_id')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as CallerProfile
}
