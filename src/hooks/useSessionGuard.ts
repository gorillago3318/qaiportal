import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const CHECK_INTERVAL_MS = 60 * 1000 // check every 60s
const NONCE_KEY = 'qai_session_nonce'

/**
 * Single-session enforcement.
 * On mount: registers this session with the server (stores a nonce).
 * Every CHECK_INTERVAL_MS: re-validates nonce — if another device replaced it, signs out.
 */
export function useSessionGuard(redirectTo = '/login') {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

    async function register() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generate a new nonce for this session
      const nonce = crypto.randomUUID()
      sessionStorage.setItem(NONCE_KEY, nonce)

      // Store on server
      await fetch('/api/session/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce }),
      })
    }

    async function validate() {
      if (!isMounted) return
      const stored = sessionStorage.getItem(NONCE_KEY)
      if (!stored) return // not registered yet

      const res = await fetch('/api/session/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce: stored }),
      })

      if (!isMounted) return
      if (res.status === 409) {
        // Another session has taken over — force logout
        await supabase.auth.signOut()
        sessionStorage.removeItem(NONCE_KEY)
        window.location.href = redirectTo + '?reason=session_replaced'
      }
    }

    register()
    intervalRef.current = setInterval(validate, CHECK_INTERVAL_MS)

    // Also validate on tab focus (catches the case where other tab just logged in)
    const onFocus = () => validate()
    window.addEventListener('focus', onFocus)

    return () => {
      isMounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('focus', onFocus)
    }
  }, [redirectTo])
}
