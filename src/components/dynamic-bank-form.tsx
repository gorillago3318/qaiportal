'use client'

import React from 'react'
import { FormField, FormSection, BankFormConfig } from '@/config/bank-forms/types'
import { cn } from '@/lib/utils'

interface DynamicFormFieldProps {
  field: FormField
  value: any
  onChange: (fieldId: string, value: any) => void
  error?: string
}

const DynamicFormField: React.FC<DynamicFormFieldProps> = ({
  field,
  value,
  onChange,
  error
}) => {
  // Check conditional rendering
  if (field.conditional) {
    let conditionMet = false

    if (field.conditional.custom_logic) {
      conditionMet = field.conditional.custom_logic(value)
    } else if (field.conditional.not_equals !== undefined) {
      conditionMet = value[field.conditional.field] !== field.conditional.not_equals
    } else if (field.conditional.equals !== undefined) {
      conditionMet = value[field.conditional.field] === field.conditional.equals
    }

    if (!conditionMet) return null
  }

  const gridClass = field.gridColumn === 2 ? 'col-span-2' : 'col-span-1'

  const inputBase = cn(
    'w-full px-3 py-2.5 text-sm rounded-lg border transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    'placeholder:text-gray-400',
    error
      ? 'border-red-400 bg-red-50'
      : 'border-gray-300 bg-white hover:border-gray-400'
  )

  const renderInput = () => {
    switch (field.type) {
      case 'date':
        return (
          <input
            type="text"
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder="DD/MM/YYYY"
            className={inputBase}
          />
        )

      case 'text':
      case 'tel':
      case 'email':
        return (
          <input
            type={field.type}
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={inputBase}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            className={inputBase}
          />
        )

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none">
              RM
            </span>
            <input
              type="number"
              value={value[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || '0.00'}
              min="0"
              step="0.01"
              className={cn(inputBase, 'pl-10')}
            />
          </div>
        )

      case 'percentage':
        return (
          <div className="relative">
            <input
              type="number"
              value={value[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || '0'}
              min="0"
              max="100"
              step="0.01"
              className={cn(inputBase, 'pr-8')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
              %
            </span>
          </div>
        )

      case 'textarea':
        return (
          <textarea
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={cn(inputBase, 'resize-none')}
          />
        )

      case 'select': {
        const selectValue =
          typeof value[field.id] === 'string' ? value[field.id] : ''
        return (
          <select
            value={selectValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            className={cn(inputBase, 'cursor-pointer')}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )
      }

      case 'radio':
        return (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {field.options?.map((option) => {
                const isSelected = value[field.id] === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(field.id, option.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {/* Inline amount input when Yes is selected */}
            {field.sub_field && value[field.id] === 'yes' && (
              <div className="flex items-center gap-3 pl-1">
                <span className="text-sm text-gray-600 shrink-0">{field.sub_field.label}:</span>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none">
                    RM
                  </span>
                  <input
                    type="number"
                    value={value[field.sub_field.id] || ''}
                    onChange={(e) => onChange(field.sub_field!.id, e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer group select-none">
            <div
              className={cn(
                'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
                value[field.id]
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white border-gray-300 group-hover:border-blue-400'
              )}
            >
              {value[field.id] && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <input
                type="checkbox"
                checked={value[field.id] || false}
                onChange={(e) => onChange(field.id, e.target.checked)}
                className="sr-only"
              />
            </div>
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        )

      default:
        return (
          <input
            type="text"
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={inputBase}
          />
        )
    }
  }

  // Read-only computed total (sum of numeric source fields)
  if (field.type === 'readonly_total') {
    const total = (field.sources || []).reduce((sum, id) => {
      const n = parseFloat(value[id])
      return sum + (isFinite(n) ? n : 0)
    }, 0)
    const formatted = total.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (
      <div className={gridClass}>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
        <div className="w-full h-10 px-3 flex items-center rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-900">
          RM {formatted}
        </div>
        <p className="text-xs text-gray-500 mt-1">Auto-calculated: sum of the amounts above.</p>
      </div>
    )
  }

  // Group header — full-width visual divider with title
  if (field.type === 'group_header') {
    return (
      <div className="col-span-2 pt-2 pb-1">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1 bg-gray-100 rounded-full">
            {field.label}
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
      </div>
    )
  }

  // Checkbox renders its own label — skip the outer label wrapper
  if (field.type === 'checkbox') {
    return (
      <div className={cn(gridClass, 'flex flex-col justify-center')}>
        {renderInput()}
        {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
      </div>
    )
  }

  return (
    <div className={gridClass}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
    </div>
  )
}

interface DynamicFormSectionProps {
  section: FormSection
  formData: Record<string, any>
  onChange: (fieldId: string, value: any) => void
  errors: Record<string, string>
}

const DynamicFormSection: React.FC<DynamicFormSectionProps> = ({
  section,
  formData,
  onChange,
  errors
}) => {
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
        {section.description && (
          <p className="text-sm text-gray-500 mt-1">{section.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {section.fields.map((field) => (
          <DynamicFormField
            key={field.id}
            field={field}
            value={formData}
            onChange={onChange}
            error={errors[field.id]}
          />
        ))}
      </div>
    </div>
  )
}

interface DynamicBankFormProps {
  config: BankFormConfig
  formData: Record<string, any>
  onChange: (fieldId: string, value: any) => void
  errors: Record<string, string>
  currentSectionIndex: number
}

export const DynamicBankForm: React.FC<DynamicBankFormProps> = ({
  config,
  formData,
  onChange,
  errors,
  currentSectionIndex
}) => {
  const section = config.sections[currentSectionIndex]

  if (!section) {
    return <div>No section found</div>
  }

  return (
    <DynamicFormSection
      section={section}
      formData={formData}
      onChange={onChange}
      errors={errors}
    />
  )
}

// Helper to get total sections count
export function getTotalSections(config: BankFormConfig): number {
  return config.sections.length
}
