"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  Sidebar,
  Topbar,
  MobileSidebarOverlay,
} from "@/components/ui/sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [userName, setUserName] = React.useState<string>("")
  const [userEmail, setUserEmail] = React.useState<string>("")
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { id: string; email?: string } | null } }) => {
      if (!user) {
        router.push("/login")
        return
      }
      setUserEmail(user.email || "")
      supabase
        .from("profiles")
        .select("full_name, role, must_change_password, agreement_signed_at")
        .eq("id", user.id)
        .single()
        .then(({ data }: { data: { full_name: string; role: string; must_change_password: boolean; agreement_signed_at: string | null } | null }) => {
          if (!data) return
          setUserName(data.full_name)
          setIsSuperAdmin(data.role === "super_admin")
          // Ensure only admins can access admin portal
          if (!["super_admin", "admin"].includes(data.role)) {
            router.push("/agent/dashboard")
            return
          }
          // Enforce onboarding flow
          if (data.must_change_password) {
            router.push("/onboarding/change-password")
            return
          }
          if (!data.agreement_signed_at) {
            router.push("/onboarding/agreement")
          }
        })
    })
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="portal-layout">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          variant="admin"
          collapsed={collapsed}
          onCollapse={setCollapsed}
          isSuperAdmin={isSuperAdmin}
        />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebarOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        <Sidebar variant="admin" isSuperAdmin={isSuperAdmin} />
      </MobileSidebarOverlay>

      {/* Main content */}
      <div className="portal-main">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userName={userName}
          userEmail={userEmail}
          onLogout={handleLogout}
          notificationsHref="/admin/notifications"
        />
        <main className="portal-content">
          {children}
        </main>
      </div>
    </div>
  )
}
