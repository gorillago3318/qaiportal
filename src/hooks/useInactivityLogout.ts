import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Auto-logs out the user after TIMEOUT_MS of inactivity.
 * Resets on mouse move, key press, click, scroll, or touch.
 */
export function useInactivityLogout(redirectTo = '/login') {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function logout() {
      await supabase.auth.signOut()
      window.location.href = redirectTo
    }

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
      timerRef.current = setTimeout(logout, TIMEOUT_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Start the timer
    reset()

    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [redirectTo])
}
