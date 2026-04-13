# 🚀 CONTINUE FROM HERE - Lawyer-Bank Implementation

**Date:** 2026-04-13  
**Status:** Database migration created but NOT RUN. Frontend UI not started.  
**Git:** All changes committed to `main` branch ✅

---

## 📍 WHERE WE ARE NOW

### **Completed Today:**
✅ Fixed critical "bumiputra column not found" error by switching to JSONB storage  
✅ Implemented Items 5-9 (dropdowns, conditional logic, validation)  
✅ Added comprehensive validation for dynamic bank forms  
✅ Created migration 010 for lawyer-bank associations  

### **NOT DONE (Next Priority):**
❌ Migration 010 NOT RUN in Supabase yet  
❌ Lawyer selection UI not implemented  
❌ Valuer 2 fields not added to UI  
❌ Render to PDF button not tested (needs successful save first)  

---

## 🔴 IMMEDIATE ACTION REQUIRED

### **Step 1: Run Migration 010 in Supabase**

Go to **Supabase Dashboard → SQL Editor** and run this file:
```
supabase/migrations/010_lawyer_bank_associations.sql
```

**What it does:**
1. Creates `lawyer_bank_associations` junction table (links lawyers to banks)
2. Adds second valuer fields: `valuer_2_name`, `valuer_2_firm`, `valuer_2_contact`, `valuer_2_email`
3. Adds auto case_code generation trigger (format: CASE-2026-00001)
4. Inserts sample panel lawyers: LWZ & Associates, Y&R Legal Chambers (both panel for HLB + OCBC)

**Verify it worked:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('lawyer_bank_associations', 'cases');

-- Check sample lawyers
SELECT id, name, firm, is_panel FROM lawyers WHERE is_panel = true;

-- Check associations
SELECT l.name, b.name as bank_name, lba.is_panel 
FROM lawyer_bank_associations lba
JOIN lawyers l ON lba.lawyer_id = l.id
JOIN banks b ON lba.bank_id = b.id;
```

---

## 🎯 NEXT TASK: Implement Lawyer Selection UI

### **Requirements:**

**Location:** Add as **Step 4** in case creation wizard  
(Current flow: Step 1=Bank, Step 2=Client Info, Step 3=Co-Borrowers, **Step 4=Lawyer**, Step 5+=Bank Forms)

**UI Components Needed:**
1. **Dropdown** to select lawyer with options:
   - Panel lawyers (fetched from database based on selected bank)
   - "Others (Non-Panel)" option

2. **Conditional Fields:**
   - If **panel lawyer** selected: Show `professional_fee` input (for commission calculation)
   - If **"Others"** selected: Show text inputs for:
     - Lawyer Name
     - Law Firm
     - Contact Number
     - Email Address

3. **Data Storage:**
   ```typescript
   // Panel lawyer
   {
     lawyer_id: "uuid-of-selected-lawyer",
     lawyer_professional_fee: 1500.00,
     lawyer_name_other: null,
     lawyer_firm_other: null
   }
   
   // Non-panel lawyer
   {
     lawyer_id: null,
     lawyer_professional_fee: null,
     lawyer_name_other: "John Doe",
     lawyer_firm_other: "ABC Legal Chambers"
   }
   ```

### **Database Query to Fetch Panel Lawyers:**

```typescript
const fetchPanelLawyers = async (selectedBank: string) => {
  const supabase = createClient()
  
  // First get the bank ID from the selected_bank name
  const { data: bankData } = await supabase
    .from('banks')
    .select('id')
    .eq('name', selectedBank)
    .single()
  
  if (!bankData) return []
  
  // Then fetch lawyers panel for this bank
  const { data: lawyers, error } = await supabase
    .from('lawyers')
    .select(`
      id,
      name,
      firm,
      email,
      phone,
      la_fee,
      spa_fee,
      mot_fee
    `)
    .eq('is_panel', true)
    .eq('is_active', true)
    .rpc('get_lawyers_for_bank', { p_bank_id: bankData.id })
  
  return lawyers || []
}
```

**Alternative simpler query (without RPC):**
```typescript
const { data: lawyers } = await supabase
  .from('lawyers')
  .select('*')
  .eq('is_panel', true)
  .eq('is_active', true)
  // Note: You may need to filter by bank association in application layer
  // or create a view/stored procedure for efficient querying
```

---

## 📋 FILES TO MODIFY

### **1. Add Lawyer Selection Step**
**File:** `src/app/agent/cases/new/page.tsx`

**Changes needed:**
- Add `selected_lawyer` field to `CaseFormData` interface
- Add lawyer-related fields to initial state
- Create `renderLawyerSelectionStep()` function
- Update `totalSteps` calculation: `const totalSteps = 4 + bankSpecificSteps`
- Add step to `renderCurrentStep()` switch statement
- Update validation logic to include lawyer step

### **2. Update Form Data Interface**
Add to `CaseFormData`:
```typescript
// Lawyer Selection
selected_lawyer: string // 'panel' | 'others' | ''
lawyer_id: string
lawyer_professional_fee: string
lawyer_name_other: string
lawyer_firm_other: string
lawyer_contact_other: string
lawyer_email_other: string
```

### **3. Update handleSubmit**
Include lawyer data in `bank_form_data` JSONB:
```typescript
bank_form_data: {
  // ... existing fields ...
  
  // Lawyer Information
  selected_lawyer: formData.selected_lawyer,
  lawyer_id: formData.lawyer_id || null,
  lawyer_professional_fee: parseFloat(formData.lawyer_professional_fee) || null,
  lawyer_name_other: formData.selected_lawyer === 'others' ? formData.lawyer_name_other : null,
  lawyer_firm_other: formData.selected_lawyer === 'others' ? formData.lawyer_firm_other : null,
  lawyer_contact_other: formData.selected_lawyer === 'others' ? formData.lawyer_contact_other : null,
  lawyer_email_other: formData.selected_lawyer === 'others' ? formData.lawyer_email_other : null,
}
```

---

## 🗄️ DATABASE SCHEMA REFERENCE

### **Cases Table (relevant fields):**
```sql
-- Existing fields:
id UUID PRIMARY KEY
case_code TEXT UNIQUE -- Auto-generated by trigger
calculation_id UUID REFERENCES calculations(id)
agent_id UUID REFERENCES profiles(id)
selected_bank TEXT
status TEXT
bank_form_data JSONB -- ALL form data stored here
notes TEXT

-- Lawyer fields:
lawyer_id UUID REFERENCES lawyers(id) -- For panel lawyers
lawyer_name_other TEXT -- For non-panel lawyers
lawyer_firm_other TEXT -- For non-panel lawyers
lawyer_professional_fee NUMERIC(12,2) -- Quoted fee for commission
lawyer_discount NUMERIC(12,2)

-- NEW from Migration 010:
valuer_2_name TEXT
valuer_2_firm TEXT
valuer_2_contact TEXT
valuer_2_email TEXT
```

### **Lawyers Table:**
```sql
id UUID PRIMARY KEY
name TEXT
firm TEXT
phone TEXT
email TEXT
la_fee NUMERIC(12,2) -- Reference fee (not currently used)
spa_fee NUMERIC(12,2)
mot_fee NUMERIC(12,2)
is_panel BOOLEAN -- Panel lawyers get commission
is_active BOOLEAN
agency_id UUID
```

### **NEW: Lawyer-Bank Associations (Migration 010):**
```sql
CREATE TABLE lawyer_bank_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  is_panel BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lawyer_id, bank_id)
);
```

---

## 💡 IMPLEMENTATION TIPS

### **Tip 1: Fetch Lawyers When Bank Changes**
Use `useEffect` to fetch panel lawyers when `formData.selected_bank` changes:
```typescript
useEffect(() => {
  if (formData.selected_bank) {
    fetchPanelLawyers(formData.selected_bank).then(setAvailableLawyers)
  } else {
    setAvailableLawyers([])
  }
}, [formData.selected_bank])
```

### **Tip 2: Conditional Rendering Pattern**
Follow the same pattern as insurance/service length conditionals:
```typescript
{formData.selected_lawyer === 'panel' && (
  <div>
    <label>Select Panel Lawyer</label>
    <select value={formData.lawyer_id} onChange={...}>
      <option value="">Choose...</option>
      {availableLawyers.map(lawyer => (
        <option key={lawyer.id} value={lawyer.id}>
          {lawyer.name} - {lawyer.firm}
        </option>
      ))}
    </select>
    
    <label>Professional Fee (RM)</label>
    <input type="number" value={formData.lawyer_professional_fee} onChange={...} />
  </div>
)}

{formData.selected_lawyer === 'others' && (
  <div>
    <label>Lawyer Name</label>
    <input type="text" value={formData.lawyer_name_other} onChange={...} />
    
    <label>Law Firm</label>
    <input type="text" value={formData.lawyer_firm_other} onChange={...} />
    
    {/* Contact and Email fields */}
  </div>
)}
```

### **Tip 3: Validation Logic**
Add to `validateStep()` function:
```typescript
if (step === 4) { // Lawyer selection step
  if (!formData.selected_lawyer) {
    newErrors.selected_lawyer = 'Please select a lawyer option'
  }
  
  if (formData.selected_lawyer === 'panel' && !formData.lawyer_id) {
    newErrors.lawyer_id = 'Please select a panel lawyer'
  }
  
  if (formData.selected_lawyer === 'panel' && !formData.lawyer_professional_fee) {
    newErrors.lawyer_professional_fee = 'Professional fee is required'
  }
  
  if (formData.selected_lawyer === 'others') {
    if (!formData.lawyer_name_other.trim()) {
      newErrors.lawyer_name_other = 'Lawyer name is required'
    }
    if (!formData.lawyer_firm_other.trim()) {
      newErrors.lawyer_firm_other = 'Law firm is required'
    }
  }
}
```

---

## 🧪 TESTING CHECKLIST

After implementing lawyer selection:

1. **Run Migration 010** ✅
2. **Create new case** → Select HLB or OCBC
3. **Fill Steps 1-3** (Bank, Client, Co-Borrowers)
4. **Step 4 (Lawyer)** should appear:
   - Dropdown shows LWZ and Y&R as options
   - "Others" option available
5. **Select panel lawyer**:
   - Professional fee input appears
   - Enter amount (e.g., 1500)
6. **Select "Others"**:
   - Text inputs for name, firm, contact, email appear
7. **Save as Draft** → Should succeed
8. **Check database**:
   ```sql
   SELECT id, case_code, lawyer_id, lawyer_professional_fee, 
          lawyer_name_other, lawyer_firm_other
   FROM cases ORDER BY created_at DESC LIMIT 1;
   ```

---

## 📊 CURRENT WORKFLOW STATUS

| Stage | Status | Notes |
|-------|--------|-------|
| **Calculation** | ✅ Working | Generates PDF report |
| **Draft Case - Bank Selection** | ✅ Working | Step 1 |
| **Draft Case - Client Info** | ✅ Working | Step 2, NRIC auto-extracts DOB |
| **Draft Case - Co-Borrowers** | ✅ Working | Step 3, max 1 co-borrower |
| **Draft Case - Lawyer Selection** | ❌ NOT STARTED | **NEXT PRIORITY** |
| **Draft Case - Bank Forms** | ✅ Working | Dynamic forms with validation |
| **Save to Database** | ✅ Fixed | Uses JSONB storage |
| **Render to PDF** | ⚠️ Needs Test | Button appears after save |
| **Convert to Case** | ❌ NOT STARTED | Document upload, status workflow |

---

## 🎯 QUICK START FOR NEW CHAT

**Paste this summary, then say:**
> "I've run migration 010 in Supabase. Now implement the lawyer selection UI as Step 4 in the case creation wizard."

The AI will:
1. Add lawyer fields to `CaseFormData` interface
2. Create lawyer selection step component
3. Add fetch logic for panel lawyers
4. Implement conditional rendering (panel vs others)
5. Update validation logic
6. Integrate with save flow

---

## 🔗 RELATED FILES

**Already exists:**
- `supabase/migrations/010_lawyer_bank_associations.sql` - Database schema
- `src/app/agent/cases/new/page.tsx` - Main case creation page
- `src/config/bank-forms/hlb.ts` - HLB form config (reference for patterns)
- `src/components/dynamic-bank-form.tsx` - Dynamic form renderer (reference)

**Need to create/modify:**
- Add lawyer step to `page.tsx`
- Possibly create `src/components/lawyer-selection.tsx` (optional, can inline)

---

## ⚠️ COMMON PITFALLS TO AVOID

1. **Don't forget to update `totalSteps`** - Must be `4 + bankSpecificSteps` now
2. **Don't store lawyer data in separate columns** - Use `bank_form_data` JSONB like everything else
3. **Don't hardcode lawyer list** - Always fetch from database based on selected bank
4. **Don't skip validation** - Ensure either panel lawyer OR other lawyer details are provided
5. **Don't forget commission logic** - Panel lawyers (`is_panel=true`) are eligible for commission

---

**Ready to continue? Run migration 010 first, then implement lawyer selection UI!**
