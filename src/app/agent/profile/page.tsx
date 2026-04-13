"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { Profile } from "@/types/database"

export default function AgentProfilePage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Bank Info form state
  const [bankName, setBankName] = React.useState("")
  const [bankAccountName, setBankAccountName] = React.useState("")
  const [bankAccountNumber, setBankAccountNumber] = React.useState("")

  React.useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        const bankProfile = data as {
          bank_name?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
        }
        setBankName(bankProfile.bank_name || "")
        setBankAccountName(bankProfile.bank_account_name || "")
        setBankAccountNumber(bankProfile.bank_account_number || "")
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({
        bank_name: bankName,
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
      })
      .eq("id", profile.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Profile updated successfully")
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8"><Loader2 className="animate-spin h-6 w-6 text-zinc-300" /></div>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-white">Profile Settings</h1>
        <p className="text-sm text-zinc-300 mt-1">Manage your account and payment details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your basic QuantifyAI agent info cannot be changed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-300 font-medium">Full Name</label>
              <div className="text-sm font-medium">{profile?.full_name}</div>
            </div>
            <div>
              <label className="text-xs text-zinc-300 font-medium">Email</label>
              <div className="text-sm font-medium">{profile?.email}</div>
            </div>
            <div>
              <label className="text-xs text-zinc-300 font-medium">Agent Code</label>
              <div className="text-sm font-medium">{profile?.agent_code || '—'}</div>
            </div>
            <div>
              <label className="text-xs text-zinc-300 font-medium">Role</label>
              <div className="text-sm font-medium capitalize">{profile?.role?.replace('_', ' ')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
            <CardDescription>We need this information to process your commission payouts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white mb-1.5 block">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. Maybank"
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/20 bg-black/35 text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-white/70"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-1.5 block">Account Name</label>
              <input
                type="text"
                placeholder="Your name exactly as per bank account"
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/20 bg-black/35 text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-white/70"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-1.5 block">Account Number</label>
              <input
                type="text"
                placeholder="Bank account number without spaces"
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/20 bg-black/35 text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-white/70"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                required
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" variant="gold" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Bank Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
