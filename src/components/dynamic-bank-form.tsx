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
      // Use custom logic function
      conditionMet = field.conditional.custom_logic(value)
    } else if (field.conditional.not_equals !== undefined) {
      // Check not equals
      conditionMet = value[field.conditional.field] !== field.conditional.not_equals
    } else if (field.conditional.equals !== undefined) {
      // Check equals (original behavior)
      conditionMet = value[field.conditional.field] === field.conditional.equals
    }
    
    if (!conditionMet) return null
  }

  const gridClass = field.gridColumn === 2 ? 'col-span-2' : 'col-span-1'

  const renderInput = () => {
    switch (field.type) {
      case 'text':
      case 'tel':
      case 'email':
      case 'date':
        return (
          <input
            type={field.type}
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
              error && "border-red-500"
            )}
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
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
              error && "border-red-500"
            )}
          />
        )

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">RM</span>
            <input
              type="number"
              value={value[field.id] || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || '0'}
              min="0"
              step="0.01"
              className={cn(
                "w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                error && "border-red-500"
              )}
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
              className={cn(
                "w-full pr-8 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                error && "border-red-500"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        )

      case 'textarea':
        return (
          <textarea
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
              error && "border-red-500"
            )}
          />
        )

      case 'select':
        // Ensure value is a scalar (string), not an object
        const selectValue = typeof value[field.id] === 'string' ? value[field.id] : ''
        return (
          <select
            value={selectValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
              error && "border-red-500"
            )}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'radio':
        return (
          <div className="flex gap-4">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={value[field.id] === option.value}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value[field.id] || false}
              onChange={(e) => onChange(field.id, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span>{field.label}</span>
          </label>
        )

      default:
        return (
          <input
            type="text"
            value={value[field.id] || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
              error && "border-red-500"
            )}
          />
        )
    }
  }

  return (
    <div className={gridClass}>
      <label className="block text-sm font-medium mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
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
      <div>
        <h2 className="text-2xl font-bold">{section.title}</h2>
        {section.description && (
          <p className="text-gray-600 mt-1">{section.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
