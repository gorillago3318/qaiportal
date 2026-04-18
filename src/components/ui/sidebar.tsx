"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Calculator,
  FolderOpen,
  DollarSign,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  User,
  Building2,
  GitBranch,
  BookOpen,
  Megaphone,
  BarChart2,
  Globe,
  FileImage,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SidebarProps {
  variant: "agent" | "admin"
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
  isSuperAdmin?: boolean
}

// ── Nav configs ─────────────────────────────────────────────

const agentNavItems: NavItem[] = [
  { href: "/agent/dashboard",    label: "Dashboard",   icon: LayoutDashboard },
  { href: "/agent/calculations", label: "Calculations", icon: Calculator },
  { href: "/agent/cases",        label: "My Cases",     icon: FolderOpen },
  { href: "/agent/commissions",  label: "Commissions",  icon: DollarSign },
  { href: "/agent/network",      label: "Network",      icon: GitBranch },
  { href: "/agent/resources",    label: "Resources",    icon: BookOpen },
  { href: "/agent/campaigns",    label: "Campaigns",    icon: Megaphone },
  { href: "/agent/profile",      label: "Profile",      icon: User },
]

const adminNavItems: NavItem[] = [
  { href: "/admin/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/admin/cases",       label: "Cases",        icon: FolderOpen },
  { href: "/admin/agents",      label: "Agents",       icon: Users },
  { href: "/admin/commissions", label: "Commissions",  icon: DollarSign },
  { href: "/admin/network",     label: "Network",      icon: GitBranch },
  { href: "/admin/resources",   label: "Resources",    icon: BookOpen },
  { href: "/admin/campaigns",   label: "Campaigns",    icon: Megaphone },
  { href: "/admin/reports",     label: "Reports",      icon: BarChart2 },
  { href: "/admin/website",     label: "Website CMS",  icon: Globe },
  { href: "/admin/settings",    label: "Settings",     icon: Settings },
]

// ── Logo ───────────────────────────────────────────────────

function QuantifyLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}>
      {/* Icon mark */}
      <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-gradient-to-tr from-accent to-accent/70 shadow-glow flex items-center justify-center">
        <span className="text-white font-heading font-bold text-sm">Q</span>
      </div>
      {!collapsed && (
        <div className="leading-none">
          <div className="font-heading font-bold text-foreground text-xl tracking-tight">
            quantify<span className="text-accent text-vibrant-gradient">.</span>
          </div>
          <div className="text-muted-foreground text-[10px] uppercase tracking-widest font-medium">
            artificial intelligence
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nav Item ───────────────────────────────────────────────

function NavItemComp({
  item,
  collapsed,
  active,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
        collapsed ? "justify-center px-2" : "",
        active
          ? "bg-[#D7263D]/12 text-[#B61F33] font-semibold shadow-sm"
          : "text-[#5F5F67] hover:bg-[#111113]/6 hover:text-[#111113] hover:translate-x-1"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          "flex-shrink-0 h-5 w-5",
          active ? "text-[#B61F33]" : "text-[#6A6A73] group-hover:text-[#111113]"
        )}
      />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
      {!collapsed && item.badge && item.badge > 0 && (
        <span className={cn(
          "ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full",
          active
            ? "bg-accent text-white"
            : "bg-[#0066CC]/10 text-[#0066CC]"
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  )
}

// ── Main Sidebar ──────────────────────────────────────────

export function Sidebar({ variant, collapsed = false, onCollapse, isSuperAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const baseAdminItems = isSuperAdmin
    ? [
        ...adminNavItems,
        { href: "/admin/agencies",     label: "Agencies",      icon: Building2 },
        { href: "/admin/convert-forms", label: "Convert Forms", icon: FileImage },
      ]
    : adminNavItems
  const navItems = variant === "agent" ? agentNavItems : baseAdminItems

  return (
    <aside
      className={cn(
        "futuristic-shell flex flex-col h-full border-r border-border/40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 relative shadow-[1px_0_24px_rgba(0,0,0,0.25)]",
        collapsed ? "w-[5rem]" : "w-[17rem]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border/50">
        <QuantifyLogo collapsed={collapsed} />
        {!collapsed && (
          <button
            onClick={() => onCollapse?.(true)}
            className="p-1.5 rounded-lg text-[#6A6A73] hover:text-[#111113] hover:bg-[#111113]/8 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle when collapsed */}
      {collapsed && (
        <button
          onClick={() => onCollapse?.(false)}
          className="mx-auto mt-2 p-1.5 rounded-lg text-[#6A6A73] hover:text-[#111113] hover:bg-[#111113]/8 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Nav label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {variant === "agent" ? "Agent Portal" : "Admin Portal"}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <NavItemComp
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={active}
            />
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/50 p-3">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl",
          collapsed ? "justify-center" : ""
        )}>
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#111113]/6 border border-[#111113]/10 flex items-center justify-center">
            <User className="h-4 w-4 text-[#111113]" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#111113] truncate">My Account</p>
              <p className="text-xs text-[#6A6A73] truncate">View profile</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

// ── Topbar ────────────────────────────────────────────────

interface TopbarProps {
  title?: string
  onMenuClick?: () => void
  userName?: string
  userEmail?: string
  unreadNotifications?: number
  onLogout?: () => void
}

export function Topbar({
  title,
  onMenuClick,
  userName,
  userEmail,
  unreadNotifications = 0,
  onLogout,
}: TopbarProps) {
  return (
    <header className="h-[4.5rem] bg-white/80 backdrop-blur-2xl sticky top-0 z-10 border-b border-border/40 flex items-center justify-between px-4 sm:px-8 flex-shrink-0">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-[#6A6A73] hover:bg-[#111113]/8 hover:text-[#111113] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {title && (
          <h1 className="font-heading font-semibold text-[#111113] text-lg hidden sm:block">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-[#6A6A73] hover:bg-[#111113]/8 hover:text-[#111113] transition-colors">
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center bg-[#FF3B30] text-white text-[10px] font-bold rounded-full">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-[#111113]/12" />

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#111113] text-white flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-[#111113] leading-none">{userName || "User"}</p>
            <p className="text-xs text-[#6A6A73] mt-0.5">{userEmail || ""}</p>
          </div>
        </div>

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-[#6A6A73] hover:bg-[#D7263D]/10 hover:text-[#B61F33] transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}

// ── Mobile Overlay ──────────────────────────────────────────

export function MobileSidebarOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 lg:hidden transition-transform duration-250",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {children}
      </div>
    </>
  )
}
