"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Bell, CheckCheck, Loader2 } from "lucide-react"
import { formatDate } from "@/lib/utils"

type Notification = {
  id: string
  user_id: string
  type: string | null
  title: string | null
  message: string | null
  case_id: string | null
  is_read: boolean
  created_at: string
}

export function NotificationsView({ basePath }: { basePath: "agent" | "admin" }) {
  const [items, setItems] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [marking, setMarking] = React.useState(false)

  const load = React.useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100)
    setItems((data || []) as Notification[])
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  const markAllRead = async () => {
    setMarking(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", session.user.id)
        .eq("is_read", false)
    }
    setMarking(false)
    load()
  }

  const markOneRead = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={marking}>
            {marking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5 mr-1.5" />}
            Mark all as read
          </Button>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-400">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <Bell className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const href = n.case_id ? `/${basePath}/cases/${n.case_id}` : null
            const inner = (
              <Card className={n.is_read ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${n.is_read ? "bg-gray-300" : "bg-[#D7263D]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-[#0A1628]">{n.title || n.type || "Notification"}</p>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(n.created_at)}</span>
                      </div>
                      {n.message && <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
            return (
              <div key={n.id} onClick={() => !n.is_read && markOneRead(n.id)}>
                {href ? <Link href={href}>{inner}</Link> : inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
