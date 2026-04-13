# Dynamic Bank Form Configuration System

## Overview

This system allows for bank-specific form configurations without modifying core code. Each bank can have its own unique set of fields, validation rules, and form structure defined in a simple TypeScript configuration file.

## Architecture

```
src/config/bank-forms/
├── types.ts          # Type definitions for form configuration
├── index.ts          # Exports all bank configs and helper functions
├── hlb.ts            # Hong Leong Bank configuration (example)
└── [bank].ts         # Add more banks here
```

## How to Add a New Bank

### Step 1: Create Bank Configuration File

Create a new file `src/config/bank-forms/[bank-id].ts`:

```typescript
import { BankFormConfig } from './types'

export const [bankId]Config: BankFormConfig = {
  bankId: 'unique_bank_id',
  bankName: 'Bank Display Name',
  sections: [
    {
      id: 'section_id',
      title: 'Section Title',
      description: 'Optional description',
      fields: [
        {
          id: 'field_id',
          label: 'Field Label',
          type: 'text', // text, number, email, tel, date, select, radio, checkbox, textarea, currency, percentage
          required: true,
          placeholder: 'Optional placeholder',
          options: [/* For select/radio types */],
          gridColumn: 1, // 1 or 2 (span columns)
          conditional: { // Optional: show field only when condition is met
            field: 'other_field_id',
            equals: 'value'
          }
        }
      ]
    }
  ]
}
```

### Step 2: Register the Bank

Add your config to `src/config/bank-forms/index.ts`:

```typescript
import { [bankId]Config } from './[bank-id]'

export const bankFormConfigs: Record<string, BankFormConfig> = {
  hong_leong_bank: hlbConfig,
  your_bank_id: [bankId]Config,  // Add here
}
```

### Step 3: Use in Component

```typescript
import { getBankFormConfig } from '@/config/bank-forms'
import { DynamicBankForm, getTotalSections } from '@/components/dynamic-bank-form'

// Get config for selected bank
const config = getBankFormConfig('hong_leong_bank')

// Render dynamic form
<DynamicBankForm
  config={config}
  formData={formData}
  onChange={handleFieldChange}
  errors={errors}
  currentSectionIndex={currentStep - 1}
/>
```

## Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Text input | Names, addresses |
| `number` | Number input | Quantities, years |
| `email` | Email input with validation | Email addresses |
| `tel` | Telephone input | Phone numbers |
| `date` | Date input (DD/MM/YYYY format) | Dates of birth, SPA dates |
| `select` | Dropdown select | Single choice from list |
| `radio` | Radio buttons | Yes/No, Male/Female |
| `checkbox` | Checkbox | Boolean flags |
| `textarea` | Multi-line text | Addresses, descriptions |
| `currency` | Currency input with RM prefix | Amounts in Ringgit |
| `percentage` | Percentage input with % suffix | Interest rates, completion % |

## Conditional Fields

Fields can be shown/hidden based on other field values:

```typescript
{
  id: 'legal_cost_amount',
  label: 'Legal Cost Amount (RM)',
  type: 'currency',
  required: false,
  conditional: { 
    field: 'finance_legal_cost',  // Show when this field...
    equals: 'yes'                  // ...equals this value
  }
}
```

## Benefits

1. **Scalability**: Add new banks without touching existing code
2. **Maintainability**: Bank-specific changes are isolated
3. **Flexibility**: Each bank can have completely different fields
4. **Type Safety**: Full TypeScript support
5. **Consistency**: All banks use the same rendering engine

## Current Implementations

- ✅ Hong Leong Bank (HLB) - Complete form with 4 sections
- 🔄 OCBC Bank - Coming soon
- 🔄 Maybank - Coming soon

## Migration Path

The system is designed to work alongside the existing static form. You can:

1. **Gradual Migration**: Start using dynamic forms for new banks while keeping old banks on static forms
2. **Hybrid Approach**: Use dynamic forms for complex bank-specific sections and static forms for common sections
3. **Full Migration**: Eventually migrate all banks to the dynamic system

## Testing

To test a bank configuration:

```typescript
import { getBankFormConfig } from '@/config/bank-forms'

const config = getBankFormConfig('hong_leong_bank')
console.log('Total sections:', config.sections.length)
console.log('All field IDs:', getAllFieldIds(config))
```

## Future Enhancements

- [ ] Custom validation functions per bank
- [ ] Field dependencies (e.g., auto-calculate based on other fields)
- [ ] Multi-language support
- [ ] Form templates/cloning from existing banks
- [ ] Visual form builder UI for non-developers
