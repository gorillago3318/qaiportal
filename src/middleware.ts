import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveAgencySlug } from '@/lib/agency'

const ADMIN_ROLES = new Set(['admin', 'super_admin'])
const PUBLIC_AUTH_PATHS = ['/login', '/forgot-password', '/auth/reset-password', '/account-disabled']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const host = request.headers.get('host') || 'localhost'
  const agencySlug = resolveAgencySlug(host)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-agency-slug', agencySlug)

  const passthrough = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => res.cookies.set(name, value))
    return res
  }
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url))

  const isProtected = pathname.startsWith('/agent') || pathname.startsWith('/admin') || pathname.startsWith('/onboarding')

  // Unauthenticated: block protected routes
  if (!user) {
    if (isProtected) return redirect('/login')
    return passthrough()
  }

  // Authenticated: fetch profile for role + flags (RLS allows reading own profile)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('role, is_active, must_change_password')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { role?: string; is_active?: boolean; must_change_password?: boolean } | null
  const role = profile?.role
  const isAdmin = role ? ADMIN_ROLES.has(role) : false

  // Deactivated account: sign out, block everywhere
  if (profile && profile.is_active === false) {
    await supabase.auth.signOut()
    if (pathname !== '/account-disabled') return redirect('/account-disabled')
    return passthrough()
  }

  // Force password change
  if (profile?.must_change_password && !pathname.startsWith('/onboarding/change-password') && !pathname.startsWith('/api')) {
    return redirect('/onboarding/change-password')
  }

  // Logged-in user on a public auth page → punt to their dashboard
  if (PUBLIC_AUTH_PATHS.includes(pathname)) {
    return redirect(isAdmin ? '/admin/dashboard' : '/agent/dashboard')
  }

  // Role-based access control
  if (pathname.startsWith('/admin') && !isAdmin) {
    return redirect('/agent/dashboard')
  }
  if (pathname.startsWith('/agent') && isAdmin) {
    // Admins can still view agent pages for support — allow, but we could also force them to /admin.
    // Keeping them on their own portal reduces confusion:
    return redirect('/admin/dashboard')
  }

  return passthrough()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
