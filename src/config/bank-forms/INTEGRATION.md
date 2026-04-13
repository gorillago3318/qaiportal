# Integration Guide: Dynamic Bank Forms

## Quick Start - Integrating with Existing Case Creation Page

### Option 1: Full Integration (Recommended for New Development)

Replace the hardcoded form steps with dynamic rendering:

```typescript
// In src/app/agent/cases/new/page.tsx

import { getBankFormConfig, getTotalSections } from '@/config/bank-forms'
import { DynamicBankForm } from '@/components/dynamic-bank-form'

// After bank selection, load the config
const [bankConfig, setBankConfig] = useState<BankFormConfig | null>(null)

useEffect(() => {
  if (formData.selected_bank) {
    const config = getBankFormConfig(formData.selected_bank)
    setBankConfig(config)
  }
}, [formData.selected_bank])

// Update total steps based on bank config
const totalSteps = bankConfig 
  ? getTotalSections(bankConfig) + 2 // +2 for bank selection and review
  : 6

// Render dynamic form sections
const renderCurrentStep = () => {
  // Step 1: Bank Selection (static)
  if (currentStep === 1) {
    return renderStep1_BankSelection()
  }
  
  // Steps 2 to N-1: Dynamic bank-specific forms
  if (bankConfig && currentStep > 1 && currentStep < totalSteps) {
    return (
      <DynamicBankForm
        config={bankConfig}
        formData={formData}
        onChange={handleInputChange}
        errors={errors}
        currentSectionIndex={currentStep - 2}
      />
    )
  }
  
  // Last Step: Review (static)
  if (currentStep === totalSteps) {
    return renderStepReview()
  }
}
```

### Option 2: Hybrid Approach (Easier Migration)

Keep existing common steps, use dynamic forms only for bank-specific sections:

```typescript
const renderCurrentStep = () => {
  switch (currentStep) {
    case 1:
      return renderStep1_BankSelection()
    case 2:
      return renderStep2_ClientInfo() // Common fields
    case 3:
      return renderStep3_LoanDetails() // Common fields
    
    // Bank-specific dynamic section
    case 4:
      if (bankConfig) {
        return (
          <DynamicBankForm
            config={bankConfig}
            formData={formData}
            onChange={handleInputChange}
            errors={errors}
            currentSectionIndex={0} // First bank-specific section
          />
        )
      }
      return renderStep4_PropertyDetails() // Fallback
    
    case 5:
      return renderStep5_CoBorrowers()
    case 6:
      return renderStep6_Review()
    default:
      return null
  }
}
```

### Option 3: Progressive Enhancement

Start with one bank, gradually migrate others:

```typescript
// Check if selected bank has dynamic config
const hasDynamicConfig = formData.selected_bank && getBankFormConfig(formData.selected_bank)

if (hasDynamicConfig) {
  // Use dynamic form
  return <DynamicBankForm ... />
} else {
  // Use legacy static form
  return renderLegacyForm()
}
```

## Data Mapping

The dynamic form uses flat field IDs. Map them to your existing data structure:

```typescript
// Example mapping function
function mapFormDataToCaseData(formData: Record<string, any>) {
  return {
    // Client info
    client_name: formData.client_name,
    client_ic: formData.client_ic,
    client_dob: formData.client_dob,
    
    // Property details
    property_address: formData.property_address,
    purchase_price: formData.purchase_price,
    
    // Loan details
    loan_amount: formData.facility_amount || formData.loan_amount,
    interest_rate: formData.interest_rate,
    
    // ... map all other fields
  }
}
```

## Validation

Add custom validation per bank:

```typescript
const validateStep = (step: number): boolean => {
  const newErrors: Record<string, string> = {}
  
  // Standard validation
  if (step === 1 && !formData.selected_bank) {
    newErrors.selected_bank = 'Please select a bank'
  }
  
  // Bank-specific validation
  if (bankConfig && currentStep > 1 && currentStep < totalSteps) {
    const currentSection = bankConfig.sections[currentStep - 2]
    currentSection.fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`
      }
    })
  }
  
  setErrors(newErrors)
  return Object.keys(newErrors).length === 0
}
```

## Pre-filling from Calculation

When converting from calculation, pre-fill dynamic fields:

```typescript
useEffect(() => {
  if (calculationId && bankConfig) {
    fetchCalculationData(calculationId).then(calc => {
      // Map calculation fields to dynamic form fields
      const mappedData = {
        ...initialForm,
        client_name: calc.client_name,
        client_ic: calc.client_ic,
        facility_amount: calc.proposed_loan_amount?.toString(),
        // ... map all relevant fields
      }
      setFormData(mappedData)
    })
  }
}, [calculationId, bankConfig])
```

## Testing Your Integration

1. **Test Bank Selection**: Ensure selecting Hong Leong Bank loads the correct config
2. **Test Field Rendering**: Verify all HLB fields appear in correct sections
3. **Test Conditional Fields**: Check that conditional fields show/hide correctly
4. **Test Validation**: Ensure required fields are validated
5. **Test Submission**: Verify data is correctly submitted to API

## Troubleshooting

**Issue**: Fields not showing up
- **Solution**: Check that field IDs match between config and formData state

**Issue**: Conditional fields not working
- **Solution**: Verify the conditional field ID exists and the value matches exactly

**Issue**: Validation not triggering
- **Solution**: Ensure you're checking `field.required` in your validation logic

**Issue**: Form data not saving
- **Solution**: Map dynamic field IDs to your API payload structure correctly

## Next Steps

1. ✅ Test with Hong Leong Bank configuration
2. 📝 Create OCBC Bank configuration
3. 🔄 Migrate existing banks one by one
4. 🎨 Add UI polish and loading states
5. 📊 Add analytics to track form completion rates
