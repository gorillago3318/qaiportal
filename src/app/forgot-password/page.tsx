"use client"

import * as React from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const redirectTo = `${window.location.origin}/auth/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-[#111113]/10 shadow-[0_18px_40px_rgba(17,17,19,0.1)] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-[#0A1628] flex items-center justify-center">
              <Mail className="h-5 w-5 text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-[#0A1628]">Forgot password?</h1>
              <p className="text-sm text-gray-500">We&apos;ll email you a reset link</p>
            </div>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
                If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox (and spam folder).
              </div>
              <Link href="/login" className="block text-center text-sm text-[#D7263D] hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@quantifyai.me"
                  className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-[#0A1628] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#D7263D] hover:bg-[#B61F33] text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#0A1628] pt-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
