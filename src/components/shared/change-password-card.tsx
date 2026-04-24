"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { KeyRound, Loader2 } from "lucide-react"

export function ChangePasswordCard() {
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return toast.error("New password must be at least 8 characters")
    if (next !== confirm) return toast.error("Passwords do not match")
    if (next === current) return toast.error("New password must differ from current")

    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any

    // Re-authenticate by signing in with current password
    const { data: sessionData } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email
    if (!email) {
      toast.error("Session expired. Please sign in again.")
      setSaving(false)
      return
    }
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (verifyErr) {
      toast.error("Current password is incorrect")
      setSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success("Password updated")
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#C9A84C]" /> Change Password
        </CardTitle>
        <CardDescription>Update your account password. You&apos;ll stay signed in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1.5">Current password</label>
            <input
              type="password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
          </div>
          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
