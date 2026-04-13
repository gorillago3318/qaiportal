// Type definitions for dynamic bank form configuration

export type FieldType = 
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'currency'
  | 'percentage'

export interface FieldOption {
  label: string
  value: string
}

export interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options?: FieldOption[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    minLength?: number
    maxLength?: number
  }
  defaultValue?: any
  conditional?: {
    field: string
    equals?: any
    not_equals?: any
    custom_logic?: (formData: Record<string, any>) => boolean
  }
  gridColumn?: 1 | 2 // Span 1 or 2 columns in grid
}

export interface FormSection {
  id: string
  title: string
  description?: string
  fields: FormField[]
}

export interface BankFormConfig {
  bankId: string
  bankName: string
  sections: FormSection[]
  // Optional: Custom validation logic can be added here
  customValidation?: (formData: Record<string, any>) => Record<string, string>
}

// Helper to get all field IDs from a config
export function getAllFieldIds(config: BankFormConfig): string[] {
  return config.sections.flatMap(section => section.fields.map(field => field.id))
}
