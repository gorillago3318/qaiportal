"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CurrencyInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  label?: string
  hint?: string
  error?: string
  className?: string
  disabled?: boolean
  readOnly?: boolean
  id?: string
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  label,
  hint,
  error,
  className,
  disabled,
  readOnly,
  id,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState<string>("")
  const isFocused = React.useRef(false)
  const inputId = id || React.useId()

  // Sync display value when value prop changes externally — skip while user is typing
  React.useEffect(() => {
    if (isFocused.current) return
    if (value === undefined || value === 0) {
      setDisplayValue("")
    } else {
      setDisplayValue(value.toLocaleString("en-MY", { maximumFractionDigits: 2 }))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const cleaned = raw.replace(/[^0-9.,]/g, "")
    const numeric = parseFloat(cleaned.replace(/,/g, ""))
    setDisplayValue(cleaned)
    if (cleaned === "" || cleaned === ".") {
      onChange(undefined)
    } else if (!isNaN(numeric)) {
      onChange(numeric)
    }
  }

  const handleFocus = () => {
    isFocused.current = true
    // Show raw number on focus so cursor works correctly
    if (value !== undefined && value !== 0) {
      setDisplayValue(value.toString())
    }
  }

  const handleBlur = () => {
    isFocused.current = false
    if (value !== undefined && value > 0) {
      setDisplayValue(value.toLocaleString("en-MY", { maximumFractionDigits: 2 }))
    } else {
      setDisplayValue("")
    }
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[#0A1628]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B7280] pointer-events-none select-none">
          RM
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            "w-full h-10 pl-10 pr-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628]",
            "focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent",
            "placeholder:text-gray-400 transition-colors",
            "disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60",
            "read-only:bg-gray-50 read-only:cursor-default",
            error && "border-red-400 focus:ring-red-400",
            className
          )}
        />
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
