"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface WizardStepIndicatorProps {
  steps: string[]
  currentStep: number // 0-indexed
}

export function WizardStepIndicator({ steps, currentStep }: WizardStepIndicatorProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max mx-auto px-2 py-4">
        {steps.map((label, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isFuture = index > currentStep

          return (
            <div key={index} className="flex items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2",
                    isCompleted && "bg-[#C9A84C] border-[#C9A84C] text-white",
                    isCurrent && "bg-[#0A1628] border-[#0A1628] text-white shadow-lg",
                    isFuture && "bg-white border-gray-300 text-gray-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap transition-colors duration-300",
                    isCompleted && "text-[#C9A84C]",
                    isCurrent && "text-[#0A1628]",
                    isFuture && "text-gray-400"
                  )}
                >
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-16 sm:w-24 mx-2 transition-colors duration-300 mt-[-18px]",
                    isCompleted ? "bg-[#C9A84C]" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
