"use client"

import { cn } from "@/lib/utils"
import { LoanType } from "@/types/database"

interface LoanTypeCardProps {
  type: LoanType
  title: string
  description: string
  icon: string
  selected: boolean
  onSelect: (type: LoanType) => void
}

export function LoanTypeCard({
  type,
  title,
  description,
  icon,
  selected,
  onSelect,
}: LoanTypeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className={cn(
        "w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:ring-offset-2",
        selected
          ? "border-[#C9A84C] bg-[#FFFBEB] shadow-md scale-[1.01]"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-colors",
            selected ? "bg-[#C9A84C]/20" : "bg-gray-100"
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "font-semibold text-base transition-colors",
                selected ? "text-[#0A1628]" : "text-[#374151]"
              )}
            >
              {title}
            </p>
            {selected && (
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#C9A84C] flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  )
}
