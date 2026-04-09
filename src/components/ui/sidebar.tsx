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
}

// ── Nav configs ─────────────────────────────────────────────

const agentNavItems: NavItem[] = [
  { href: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent/calculations", label: "Calculations", icon: Calculator },
  { href: "/agent/cases", label: "My Cases", icon: FolderOpen },
  { href: "/agent/commissions", label: "Commissions", icon: DollarSign },
  { href: "/agent/profile", label: "Profile", icon: User },
]

const adminNavItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/cases", label: "Cases", icon: FolderOpen },
  { href: "/admin/agents", label: "Agents", icon: Users },
  { href: "/admin/commissions", label: "Commissions", icon: DollarSign },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

// ── Logo ───────────────────────────────────────────────────

function QuantifyLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}>
      {/* Icon mark */}
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-[#C9A84C] flex items-center justify-center">
        <span className="text-[#0A1628] font-heading font-bold text-sm">Q</span>
      </div>
      {!collapsed && (
        <div className="leading-none">
          <div className="font-heading font-bold text-white text-lg tracking-tight">
            quantify<span className="text-[#C9A84C]">.</span>
          </div>
          <div className="text-[#7E96BC] text-[10px] uppercase tracking-widest font-medium">
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
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center px-2" : "",
        active
          ? "bg-[#C9A84C] text-[#0A1628] shadow-sm"
          : "text-[#7E96BC] hover:bg-[#142847] hover:text-white"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          "flex-shrink-0 h-5 w-5",
          active ? "text-[#0A1628]" : "text-[#5373A6] group-hover:text-white"
        )}
      />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
      {!collapsed && item.badge && item.badge > 0 && (
        <span className={cn(
          "ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full",
          active
            ? "bg-[#0A1628]/20 text-[#0A1628]"
            : "bg-[#C9A84C] text-[#0A1628]"
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  )
}

// ── Main Sidebar ──────────────────────────────────────────

export function Sidebar({ variant, collapsed = false, onCollapse }: SidebarProps) {
  const pathname = usePathname()
  const navItems = variant === "agent" ? agentNavItems : adminNavItems

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#0A1628] border-r border-[#142847] transition-all duration-250 ease-in-out",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#142847]">
        <QuantifyLogo collapsed={collapsed} />
        {!collapsed && (
          <button
            onClick={() => onCollapse?.(true)}
            className="p-1.5 rounded-lg text-[#5373A6] hover:text-white hover:bg-[#142847] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle when collapsed */}
      {collapsed && (
        <button
          onClick={() => onCollapse?.(false)}
          className="mx-auto mt-2 p-1.5 rounded-lg text-[#5373A6] hover:text-white hover:bg-[#142847] transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Nav label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5373A6]">
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
      <div className="border-t border-[#142847] p-3">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl",
          collapsed ? "justify-center" : ""
        )}>
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#142847] border border-[#1E3A5F] flex items-center justify-center">
            <User className="h-4 w-4 text-[#7E96BC]" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">My Account</p>
              <p className="text-xs text-[#5373A6] truncate">View profile</p>
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
    <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {title && (
          <h1 className="font-heading font-semibold text-[#0A1628] text-lg hidden sm:block">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center bg-[#C9A84C] text-[#0A1628] text-[10px] font-bold rounded-full">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-[#E5E7EB]" />

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#0A1628] flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-[#0A1628] leading-none">{userName || "User"}</p>
            <p className="text-xs text-[#6B7280] mt-0.5">{userEmail || ""}</p>
          </div>
        </div>

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors"
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
