# 🚀 Lawyer Commission Workflow Implementation Guide

**Date:** 2026-04-13  
**Status:** SQL Migration Created - Ready to Run  
**Next Steps:** Run migration → Build UI → Test workflow

---

## 📋 OVERVIEW

This implementation adds complete lawyer commission workflow with:
1. **Special Arrangement Discount** - Track discounts given by panel lawyers
2. **Bank-Lawyer Associations** - Manage which lawyers are panel for which banks
3. **Amendment Audit Trail** - Log all financial field changes made by admin
4. **Agent Lawyer Selection UI** - Step 4 in case creation wizard

---

## 🔴 STEP 1: RUN DATABASE MIGRATION (MANDATORY)

### Go to Supabase Dashboard → SQL Editor

**Run this file first:**
```
supabase/migrations/011_lawyer_commission_enhancement.sql
```

**What it does:**
1. ✅ Adds `special_arrangement_discount` column to cases table
2. ✅ Creates `lawyer_bank_associations` junction table (if not exists from migration 010)
3. ✅ Adds second valuer fields (`valuer_2_*`)
4. ✅ Ensures `lawyer_professional_fee` column exists
5. ✅ Creates `case_amendment_log` table for tracking financial amendments
6. ✅ Adds trigger to auto-log changes to financial fields
7. ✅ Inserts sample panel lawyers (LWZ & Associates, Y&R Legal Chambers)
8. ✅ Associates sample lawyers with HLB and OCBC banks

**Then verify it worked:**
```
supabase/migrations/VERIFY_MIGRATION_011.sql
```

You should see:
- ✅ All checks pass
- ✅ 2 panel lawyers listed with bank associations
- ✅ Summary shows correct counts

---

## 🎯 STEP 2: IMPLEMENT LAWYER SELECTION UI (AGENT SIDE)

### File to Modify: `src/app/agent/cases/new/page.tsx`

#### A. Update CaseFormData Interface

Add these fields after existing fields:

```typescript
// Lawyer Selection (Step 4)
selected_lawyer_type: 'panel' | 'others' | ''  // Type of lawyer selection
lawyer_id: string                               // UUID if panel lawyer selected
lawyer_professional_fee: string                 // Quoted fee from quotation
has_special_arrangement: boolean                // Checkbox for special discount
special_arrangement_discount: string            // Discount amount if checkbox checked
// Non-panel lawyer details
lawyer_name_other: string
lawyer_firm_other: string
lawyer_contact_other: string
lawyer_email_other: string
```

#### B. Add to Initial State

```typescript
const [formData, setFormData] = useState<CaseFormData>({
  // ... existing fields ...
  
  // Lawyer Selection
  selected_lawyer_type: '',
  lawyer_id: '',
  lawyer_professional_fee: '',
  has_special_arrangement: false,
  special_arrangement_discount: '',
  lawyer_name_other: '',
  lawyer_firm_other: '',
  lawyer_contact_other: '',
  lawyer_email_other: '',
})
```

#### C. Fetch Panel Lawyers When Bank Changes

Add this useEffect after existing state declarations:

```typescript
const [availableLawyers, setAvailableLawyers] = useState<Array<{
  id: string
  name: string
  firm: string
  email: string | null
  phone: string | null
}>>([])

useEffect(() => {
  const fetchPanelLawyers = async () => {
    if (!formData.selected_bank) {
      setAvailableLawyers([])
      return
    }
    
    try {
      const supabase = createClient()
      
      // Get bank ID first
      const { data: bankData } = await supabase
        .from('banks')
        .select('id')
        .eq('name', formData.selected_bank)
        .single()
      
      if (!bankData) {
        setAvailableLawyers([])
        return
      }
      
      // Fetch lawyers panel for this bank via association table
      const { data: associations } = await supabase
        .from('lawyer_bank_associations')
        .select('lawyer_id')
        .eq('bank_id', bankData.id)
        .eq('is_panel', true)
      
      if (!associations || associations.length === 0) {
        setAvailableLawyers([])
        return
      }
      
      const lawyerIds = associations.map(a => a.lawyer_id)
      
      const { data: lawyers, error } = await supabase
        .from('lawyers')
        .select('id, name, firm, email, phone')
        .in('id', lawyerIds)
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      
      setAvailableLawyers(lawyers || [])
    } catch (error) {
      console.error('Error fetching panel lawyers:', error)
      setAvailableLawyers([])
    }
  }
  
  fetchPanelLawyers()
}, [formData.selected_bank])
```

#### D. Create Lawyer Selection Step Component

Add this function before `renderCurrentStep()`:

```typescript
const renderStep4_LawyerSelection = () => {
  const f = (field: keyof CaseFormData) => (value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Lawyer Selection</h2>
        <p className="text-gray-600 mt-1">Select the handling lawyer for this case</p>
      </div>

      {/* Lawyer Type Selection */}
      <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-3">
        <label className="text-sm font-semibold text-[#0A1628]">
          Lawyer Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              f('selected_lawyer_type')('panel')
              // Clear non-panel fields when switching to panel
              setFormData(prev => ({
                ...prev,
                lawyer_name_other: '',
                lawyer_firm_other: '',
                lawyer_contact_other: '',
                lawyer_email_other: ''
              }))
            }}
            className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
              formData.selected_lawyer_type === 'panel'
                ? 'border-[#C9A84C] bg-[#FFF9EC] text-[#0A1628]'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">Panel Lawyer</div>
            <div className="text-xs text-gray-500 mt-1">Entitled to commission</div>
          </button>
          
          <button
            type="button"
            onClick={() => {
              f('selected_lawyer_type')('others')
              // Clear panel fields when switching to others
              setFormData(prev => ({
                ...prev,
                lawyer_id: '',
                lawyer_professional_fee: '',
                has_special_arrangement: false,
                special_arrangement_discount: ''
              }))
            }}
            className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
              formData.selected_lawyer_type === 'others'
                ? 'border-[#C9A84C] bg-[#FFF9EC] text-[#0A1628]'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">Others (Non-Panel)</div>
            <div className="text-xs text-gray-500 mt-1">No commission</div>
          </button>
        </div>
      </div>

      {/* Panel Lawyer Options */}
      {formData.selected_lawyer_type === 'panel' && (
        <div className="space-y-4">
          {/* Select Lawyer Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Panel Lawyer <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.lawyer_id}
              onChange={(e) => f('lawyer_id')(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              required
            >
              <option value="">Choose a lawyer...</option>
              {availableLawyers.map(lawyer => (
                <option key={lawyer.id} value={lawyer.id}>
                  {lawyer.name} - {lawyer.firm}
                </option>
              ))}
            </select>
            {availableLawyers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ No panel lawyers found for {formData.selected_bank}. Please contact admin.
              </p>
            )}
          </div>

          {/* Professional Fee Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Professional Fee from Quotation (RM) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.lawyer_professional_fee}
              onChange={(e) => f('lawyer_professional_fee')(e.target.value)}
              placeholder="e.g. 6250.00"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the professional fee amount from the lawyer's quotation (excluding stamp duty & disbursements)
            </p>
          </div>

          {/* Special Arrangement Checkbox */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="specialArrangement"
                checked={formData.has_special_arrangement}
                onChange={(e) => {
                  f('has_special_arrangement')(e.target.checked)
                  if (!e.target.checked) {
                    f('special_arrangement_discount')('')
                  }
                }}
                className="mt-1 rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]"
              />
              <div>
                <label htmlFor="specialArrangement" className="text-sm font-medium text-gray-700">
                  Special Arrangement - Did the lawyer give any discount to the client?
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  This discount will be deducted from the professional fee for commission calculation
                </p>
              </div>
            </div>
            
            {formData.has_special_arrangement && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Amount (RM) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.special_arrangement_discount}
                  onChange={(e) => f('special_arrangement_discount')(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  required
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-Panel Lawyer Details */}
      {formData.selected_lawyer_type === 'others' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              ⚠ External/non-panel lawyers do not generate commission for agents
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lawyer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lawyer_name_other}
                onChange={(e) => f('lawyer_name_other')(e.target.value)}
                placeholder="e.g. Tan Ah Kow"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Law Firm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lawyer_firm_other}
                onChange={(e) => f('lawyer_firm_other')(e.target.value)}
                placeholder="e.g. Tan & Partners"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.lawyer_contact_other}
                onChange={(e) => f('lawyer_contact_other')(e.target.value)}
                placeholder="+601X-XXXXXXX"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.lawyer_email_other}
                onChange={(e) => f('lawyer_email_other')(e.target.value)}
                placeholder="lawyer@firm.com"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Important Notes:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Professional fee is used for commission calculation</li>
          <li>Special arrangement discount reduces the commissionable amount</li>
          <li>You can upload the actual quotation PDF later when submitting the case</li>
          <li>Admin may adjust these figures after case acceptance if needed</li>
        </ul>
      </div>
    </div>
  )
}
```

#### E. Update totalSteps Calculation

Find this line:
```typescript
const totalSteps = 3 + bankSpecificSteps
```

Change to:
```typescript
const totalSteps = 4 + bankSpecificSteps  // Added Step 4: Lawyer Selection
```

#### F. Update renderCurrentStep Switch Statement

Add case 4:
```typescript
const renderCurrentStep = () => {
  switch (currentStep) {
    case 1:
      return renderStep1_BankSelection()
    case 2:
      return renderStep2_ClientInfo()
    case 3:
      return renderStep3_CoBorrowers()
    case 4:
      return renderStep4_LawyerSelection()  // NEW
    default:
      // Bank-specific steps start at step 5
      if (bankConfig && currentStep > 4 && currentStep <= 4 + bankSpecificSteps) {
        const sectionIndex = currentStep - 5
        // ... rest of existing code ...
```

#### G. Update Validation Logic

In the `validateStep()` function, add:

```typescript
if (step === 4) {
  // Lawyer selection validation
  if (!formData.selected_lawyer_type) {
    newErrors.selected_lawyer_type = 'Please select lawyer type'
  }
  
  if (formData.selected_lawyer_type === 'panel') {
    if (!formData.lawyer_id) {
      newErrors.lawyer_id = 'Please select a panel lawyer'
    }
    if (!formData.lawyer_professional_fee || parseFloat(formData.lawyer_professional_fee) <= 0) {
      newErrors.lawyer_professional_fee = 'Professional fee is required and must be greater than 0'
    }
    if (formData.has_special_arrangement && (!formData.special_arrangement_discount || parseFloat(formData.special_arrangement_discount) <= 0)) {
      newErrors.special_arrangement_discount = 'Discount amount is required when special arrangement is checked'
    }
  }
  
  if (formData.selected_lawyer_type === 'others') {
    if (!formData.lawyer_name_other.trim()) {
      newErrors.lawyer_name_other = 'Lawyer name is required'
    }
    if (!formData.lawyer_firm_other.trim()) {
      newErrors.lawyer_firm_other = 'Law firm is required'
    }
  }
}
```

#### H. Update handleSubmit to Include Lawyer Data

In the `handleSubmit` function, when building `bank_form_data`, add:

```typescript
bank_form_data: {
  // ... existing fields ...
  
  // Lawyer Information
  selected_lawyer_type: formData.selected_lawyer_type,
  lawyer_id: formData.selected_lawyer_type === 'panel' ? formData.lawyer_id : null,
  lawyer_professional_fee: formData.selected_lawyer_type === 'panel' ? parseFloat(formData.lawyer_professional_fee) || null : null,
  has_special_arrangement: formData.has_special_arrangement || false,
  special_arrangement_discount: formData.has_special_arrangement ? parseFloat(formData.special_arrangement_discount) || 0 : 0,
  lawyer_name_other: formData.selected_lawyer_type === 'others' ? formData.lawyer_name_other : null,
  lawyer_firm_other: formData.selected_lawyer_type === 'others' ? formData.lawyer_firm_other : null,
  lawyer_contact_other: formData.selected_lawyer_type === 'others' ? formData.lawyer_contact_other : null,
  lawyer_email_other: formData.selected_lawyer_type === 'others' ? formData.lawyer_email_other : null,
}
```

Also update the direct case columns:

```typescript
// In the API route, map these fields:
lawyer_id: formData.selected_lawyer_type === 'panel' ? formData.lawyer_id : null,
lawyer_professional_fee: formData.selected_lawyer_type === 'panel' ? parseFloat(formData.lawyer_professional_fee) || null : null,
special_arrangement_discount: formData.has_special_arrangement ? parseFloat(formData.special_arrangement_discount) || 0 : 0,
lawyer_name_other: formData.selected_lawyer_type === 'others' ? formData.lawyer_name_other : null,
lawyer_firm_other: formData.selected_lawyer_type === 'others' ? formData.lawyer_firm_other : null,
lawyer_contact: formData.selected_lawyer_type === 'others' ? formData.lawyer_contact_other : null,
lawyer_email: formData.selected_lawyer_type === 'others' ? formData.lawyer_email_other : null,
```

---

## 🎨 STEP 3: ADD BANK ASSOCIATION UI (ADMIN SIDE)

### File to Modify: `src/app/admin/settings/page.tsx`

In the `LawyersTab` component, add bank association management:

```typescript
// Add state for bank associations
const [bankAssociations, setBankAssociations] = React.useState<Record<string, string[]>>({})
const [allBanks, setAllBanks] = React.useState<Array<{ id: string; name: string }>>([])

// Fetch banks and associations on mount
React.useEffect(() => {
  const fetchData = async () => {
    // Fetch all banks
    const { data: banks } = await supabase.from('banks').select('id, name').order('name')
    setAllBanks(banks || [])
    
    // Fetch all associations
    const { data: associations } = await supabase
      .from('lawyer_bank_associations')
      .select('lawyer_id, bank_id')
    
    // Group by lawyer_id
    const grouped: Record<string, string[]> = {}
    associations?.forEach(assoc => {
      if (!grouped[assoc.lawyer_id]) {
        grouped[assoc.lawyer_id] = []
      }
      grouped[assoc.lawyer_id].push(assoc.bank_id)
    })
    setBankAssociations(grouped)
  }
  
  fetchData()
}, [])

// Handler to toggle bank association
const handleToggleBankAssociation = async (lawyerId: string, bankId: string) => {
  const currentBanks = bankAssociations[lawyerId] || []
  const isSelected = currentBanks.includes(bankId)
  
  if (isSelected) {
    // Remove association
    await supabase
      .from('lawyer_bank_associations')
      .delete()
      .eq('lawyer_id', lawyerId)
      .eq('bank_id', bankId)
    
    setBankAssociations(prev => ({
      ...prev,
      [lawyerId]: currentBanks.filter(id => id !== bankId)
    }))
  } else {
    // Add association
    await supabase
      .from('lawyer_bank_associations')
      .insert({ lawyer_id: lawyerId, bank_id: bankId, is_panel: true })
    
    setBankAssociations(prev => ({
      ...prev,
      [lawyerId]: [...currentBanks, bankId]
    }))
  }
}

// In the table row for each lawyer, add:
<td className="px-4 py-3.5">
  <div className="space-y-1">
    {allBanks.map(bank => (
      <label key={bank.id} className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(bankAssociations[l.id] || []).includes(bank.id)}
          onChange={() => handleToggleBankAssociation(l.id, bank.id)}
          className="rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]"
        />
        <span>{bank.name}</span>
      </label>
    ))}
  </div>
</td>
```

---

## 🧪 STEP 4: TESTING CHECKLIST

After implementing:

### Database
- [ ] Migration 011 ran successfully
- [ ] Verification script shows all ✅
- [ ] Sample lawyers exist with bank associations

### Agent Side
- [ ] Create new case → Select HLB or OCBC
- [ ] Fill Steps 1-3
- [ ] Step 4 appears with lawyer selection
- [ ] Panel lawyer dropdown shows LWZ and Y&R
- [ ] Selecting panel lawyer shows professional fee input
- [ ] Checking "Special Arrangement" shows discount input
- [ ] Selecting "Others" shows manual entry fields
- [ ] Validation works correctly
- [ ] Save as Draft succeeds
- [ ] Check database: lawyer fields populated correctly

### Admin Side
- [ ] Settings → Panel Lawyers tab
- [ ] Can see bank checkboxes for each lawyer
- [ ] Toggling checkboxes updates associations
- [ ] Refresh page → associations persist

### Amendment Tracking
- [ ] Update lawyer_professional_fee in database manually
- [ ] Check case_amendment_log table → entry created
- [ ] Verify old_value, new_value, amended_by recorded

---

## 📊 COMMISSION CALCULATION UPDATE

The commission calculation logic needs to use:

```typescript
// Net fee for commission calculation
const netProfessionalFee = lawyer_professional_fee - special_arrangement_discount

// QAI share (70%)
const qaiShare = netProfessionalFee * 0.70

// Company cut (10% of QAI share)
const companyCut = qaiShare * 0.10

// Net distributable
const netDistributable = qaiShare - companyCut
```

Update the commission API route (`/api/cases/[id]/commission/route.ts`) to include `special_arrangement_discount` in calculations.

---

## 🎯 NEXT STEPS AFTER THIS

1. ✅ Run migration 011
2. ✅ Implement lawyer selection UI (Step 4)
3. ✅ Add bank association UI (admin settings)
4. ⏸️ Document upload feature (separate task)
5. ⏸️ Admin case detail amendment UI (separate task)
6. ⏸️ Commission calculation adjustment (separate task)

---

**Ready to start? Run the migration first, then implement the UI changes!**
