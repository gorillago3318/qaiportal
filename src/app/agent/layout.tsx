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

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [userName, setUserName] = React.useState<string>("")
  const [userEmail, setUserEmail] = React.useState<string>("")

  React.useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login")
        return
      }
      setUserEmail(user.email || "")
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setUserName((data as { full_name: string }).full_name)
        })
    })
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Signed out successfully")
    router.push("/login")
  }

  return (
    <div className="portal-layout">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          variant="agent"
          collapsed={collapsed}
          onCollapse={setCollapsed}
        />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebarOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        <Sidebar variant="agent" />
      </MobileSidebarOverlay>

      {/* Main content */}
      <div className="portal-main">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userName={userName}
          userEmail={userEmail}
          onLogout={handleLogout}
        />
        <main className="portal-content">
          {children}
        </main>
      </div>
    </div>
  )
}
