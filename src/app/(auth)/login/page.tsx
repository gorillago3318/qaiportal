"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type UserRole } from "@/types/database"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      const supabase = createClient()

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        toast.error(authError.message || "Invalid email or password")
        return
      }

      // Fetch user profile to determine role-based redirect
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Authentication failed. Please try again.")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      const adminRoles: UserRole[] = ["super_admin", "admin"]
      const isAdmin = profile?.role && adminRoles.includes(profile.role as UserRole)

      toast.success("Welcome back!")

      if (isAdmin) {
        router.push("/admin/dashboard")
      } else {
        router.push("/agent/dashboard")
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A1628] flex-col items-center justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A84C]/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#C9A84C]/5 rounded-full translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#142847] rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50" />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-12">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-[#C9A84C] flex items-center justify-center shadow-[0_0_20px_rgba(201,168,76,0.4)]">
                <span className="text-[#0A1628] font-heading font-bold text-2xl">Q</span>
              </div>
              <div className="text-left">
                <div className="font-heading font-bold text-white text-3xl leading-none">
                  quantify<span className="text-[#C9A84C]">.</span>
                </div>
                <div className="text-[#5373A6] text-xs uppercase tracking-[0.2em] font-medium mt-1">
                  artificial intelligence
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-16 h-0.5 bg-[#C9A84C] mx-auto mb-8 rounded-full" />

          {/* Tagline */}
          <h2 className="font-heading text-white text-2xl font-semibold leading-tight mb-3">
            Quantifying Success,
            <br />
            <span className="text-[#C9A84C]">Simplifying Finance</span>
          </h2>
          <p className="text-[#5373A6] text-sm leading-relaxed max-w-xs mx-auto">
            Malaysia&apos;s premier mortgage refinance agency portal for agents and administrators.
          </p>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { label: "Cases Processed", value: "2,400+" },
              { label: "Agents", value: "40+" },
              { label: "Banks", value: "17" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[#C9A84C] font-heading font-bold text-xl">{stat.value}</div>
                <div className="text-[#5373A6] text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F8F9FA]">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-[#0A1628] flex items-center justify-center">
              <span className="text-[#C9A84C] font-heading font-bold text-lg">Q</span>
            </div>
            <div className="font-heading font-bold text-[#0A1628] text-2xl">
              quantify<span className="text-[#C9A84C]">.</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-[0_4px_6px_-1px_rgba(10,22,40,0.08),0_2px_4px_-2px_rgba(10,22,40,0.04)]">
            <div className="mb-8">
              <h1 className="font-heading font-bold text-[#0A1628] text-2xl mb-1.5">
                Welcome back
              </h1>
              <p className="text-[#6B7280] text-sm">
                Sign in to your QuantifyAI account
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@quantifyai.me"
                    className="pl-9"
                    error={!!errors.email}
                    autoComplete="email"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-[#EF4444]">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" required>
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    error={!!errors.password}
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-[#EF4444]">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full mt-2 bg-[#0A1628] hover:bg-[#142847]"
                loading={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-[#E5E7EB] text-center">
              <p className="text-xs text-[#9CA3AF]">
                Having trouble signing in? Contact your administrator.
              </p>
            </div>
          </div>

          {/* Bottom note */}
          <p className="mt-6 text-center text-xs text-[#9CA3AF]">
            &copy; {new Date().getFullYear()} QuantifyAI Sdn Bhd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
