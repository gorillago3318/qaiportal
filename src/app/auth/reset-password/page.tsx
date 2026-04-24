"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    // Supabase redirects here with a recovery session already set via URL hash.
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (!data.session) {
        toast.error("Reset link invalid or expired. Please request a new one.")
        setTimeout(() => router.push("/forgot-password"), 1500)
        return
      }
      setReady(true)
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return toast.error("Password must be at least 8 characters")
    if (password !== confirm) return toast.error("Passwords do not match")
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success("Password updated. Please sign in.")
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
        <div className="text-sm text-gray-500">Verifying reset link…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-[#111113]/10 shadow-[0_18px_40px_rgba(17,17,19,0.1)] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-[#0A1628] flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-[#0A1628]">Choose a new password</h1>
              <p className="text-sm text-gray-500">Min. 8 characters</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0A1628] mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#0A1628] hover:bg-[#0d1f38] text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
