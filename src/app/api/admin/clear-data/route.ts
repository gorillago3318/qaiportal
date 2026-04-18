import { NextResponse } from 'next/server'
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
 * POST /api/admin/clear-data
 * Super-admin only. Clears ALL demo/test data while keeping the super_admin account.
 * Deletes: case_documents, case_comments, case_status_history, co_borrowers,
 *          case_co_broke, commissions, notifications, cases, calculations, clients,
 *          lawyer_bank_associations, and all non-super_admin profiles + auth users.
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const admin = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
    }

    const errors: string[] = []

    // 1. Clear leaf tables first (FK dependencies)
    const leafTables = [
      'case_documents',
      'case_comments',
      'case_status_history',
      'co_borrowers',
      'case_co_broke',
      'commissions',
      'notifications',
    ]
    for (const table of leafTables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any).from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) errors.push(`${table}: ${error.message}`)
    }

    // 2. Clear cases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: casesErr } = await (admin as any).from('cases').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (casesErr) errors.push(`cases: ${casesErr.message}`)

    // 3. Clear calculations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: calcErr } = await (admin as any).from('calculations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (calcErr) errors.push(`calculations: ${calcErr.message}`)

    // 4. Clear clients
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: clientErr } = await (admin as any).from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (clientErr) errors.push(`clients: ${clientErr.message}`)

    // 5. Clear lawyer_bank_associations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lbaErr } = await (admin as any)
      .from('lawyer_bank_associations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (lbaErr && !lbaErr.message?.includes('does not exist')) {
      errors.push(`lawyer_bank_associations: ${lbaErr.message}`)
    }

    // 6. Clear lawyers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lawyerErr } = await (admin as any).from('lawyers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (lawyerErr) errors.push(`lawyers: ${lawyerErr.message}`)

    // 7. Delete all non-super_admin profiles (and linked auth users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: nonAdminProfiles } = await (admin as any)
      .from('profiles')
      .select('id, email, role')
      .not('role', 'in', '(super_admin)')

    const deletedUsers: string[] = []
    for (const p of (nonAdminProfiles ?? [])) {
      // Delete from auth.users via admin API
      const { error: authDelErr } = await admin.auth.admin.deleteUser(p.id)
      if (authDelErr) {
        errors.push(`auth.users ${p.email}: ${authDelErr.message}`)
      } else {
        deletedUsers.push(p.email)
      }
      // Profile is cascade-deleted when auth user is deleted
    }

    return NextResponse.json({
      success: true,
      deleted_users: deletedUsers,
      errors: errors.length > 0 ? errors : undefined,
      message: `Cleared all demo data. ${deletedUsers.length} user account(s) removed.`,
    })
  } catch (err) {
    console.error('[clear-data]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
