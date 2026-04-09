"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { monthsToYearsMonths } from "@/lib/utils"

interface TenureInputProps {
  years: number | undefined
  months: number | undefined
  onChange: (years: number | undefined, months: number | undefined) => void
  maxMonths?: number
  label?: string
  className?: string
  disabled?: boolean
}

export function TenureInput({
  years,
  months,
  onChange,
  maxMonths,
  label,
  className,
  disabled,
}: TenureInputProps) {
  const totalMonths = ((years ?? 0) * 12) + (months ?? 0)
  const exceedsMax = maxMonths !== undefined && totalMonths > maxMonths

  const handleYearsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "") {
      onChange(undefined, months)
    } else {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 0 && num <= 50) {
        onChange(num, months)
      }
    }
  }

  const handleMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "") {
      onChange(years, undefined)
    } else {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 0 && num <= 11) {
        onChange(years, num)
      }
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-sm font-medium text-[#0A1628]">
          {label}
        </label>
      )}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={50}
            value={years ?? ""}
            onChange={handleYearsChange}
            placeholder="0"
            disabled={disabled}
            className={cn(
              "w-full h-10 pl-3 pr-12 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628]",
              "focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent",
              "placeholder:text-gray-400 transition-colors",
              "disabled:bg-gray-50 disabled:cursor-not-allowed",
              exceedsMax && "border-amber-400 focus:ring-amber-400"
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            yrs
          </span>
        </div>
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={11}
            value={months ?? ""}
            onChange={handleMonthsChange}
            placeholder="0"
            disabled={disabled}
            className={cn(
              "w-full h-10 pl-3 pr-12 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628]",
              "focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent",
              "placeholder:text-gray-400 transition-colors",
              "disabled:bg-gray-50 disabled:cursor-not-allowed",
              exceedsMax && "border-amber-400 focus:ring-amber-400"
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            mo
          </span>
        </div>
      </div>

      {/* Totals and hints */}
      <div className="flex items-center justify-between">
        {totalMonths > 0 ? (
          <p className="text-xs text-gray-500">
            = {totalMonths} months ({monthsToYearsMonths(totalMonths)})
          </p>
        ) : (
          <p className="text-xs text-gray-400">Enter years and/or months</p>
        )}

        {maxMonths !== undefined && maxMonths > 0 && (
          <p className={cn(
            "text-xs font-medium",
            exceedsMax ? "text-amber-600" : "text-gray-500"
          )}>
            Max: {monthsToYearsMonths(maxMonths)}
            {exceedsMax && " ⚠️ Exceeds max"}
          </p>
        )}
      </div>
    </div>
  )
}
