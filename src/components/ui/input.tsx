import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#0A1628] transition-colors",
          "placeholder:text-[#9CA3AF]",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#F9FAFB]",
          error
            ? "border-[#EF4444] focus:ring-[#EF4444]/30 focus:border-[#EF4444]"
            : "border-[#E5E7EB] focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
