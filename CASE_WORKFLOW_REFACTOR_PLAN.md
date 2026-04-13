# Case Creation Workflow Refactor - Action Plan

## Current Issues Identified:

1. ❌ **Wrong Section Order**: Financing details come before personal/employment info
2. ❌ **Missing Co-Borrower Employment**: Co-borrowers don't have employment detail fields
3. ❌ **No "Render to Form" Button**: Missing PDF generation for client signature
4. ❌ **No Draft Save Option**: Can't save incomplete cases
5. ❌ **Missing Lawyer & Valuer Fields**: No input sections for lawyer/valuer information
6. ⚠️ **Date Format**: Need to ensure all dates use DD/MM/YYYY

## Required Changes:

### 1. Reorder Bank Form Sections (Logical Flow)

**New Section Order:**
1. ✅ Personal Details (Name, IC, DOB, Citizenship, Address, Contact)
2. ✅ Employment Details (Employer, Income, Length of Service)
3. ✅ Financing Details (Loan amount, tenure, product type, purpose)
4. ✅ Property Details (Address, price, type, size)
5. ✅ Title Details (Title type, land tenure, restrictions)
6. ✅ Co-Borrower Details (Full personal + employment info for each co-borrower)
7. ✅ Other Financing Facilities (Existing loans table)
8. ✅ Lawyer & Valuer Information (NEW SECTION)
9. ✅ Review & Actions (Render to Form / Save as Draft)

### 2. Add Lawyer & Valuer Section

```typescript
{
  id: 'lawyer_valuer',
  title: 'Lawyer & Valuer Information',
  description: 'Professional service providers',
  fields: [
    {
      id: 'has_lawyer',
      label: 'Do you have a appointed lawyer?',
      type: 'radio',
      required: true,
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' }
      ]
    },
    {
      id: 'lawyer_name',
      label: 'Lawyer Name',
      type: 'text',
      required: false,
      conditional: { field: 'has_lawyer', equals: 'yes' }
    },
    {
      id: 'lawyer_firm',
      label: 'Law Firm Name',
      type: 'text',
      required: false,
      conditional: { field: 'has_lawyer', equals: 'yes' }
    },
    {
      id: 'lawyer_contact',
      label: 'Lawyer Contact Number',
      type: 'tel',
      required: false,
      conditional: { field: 'has_lawyer', equals: 'yes' }
    },
    {
      id: 'has_valuer',
      label: 'Do you have a appointed valuer?',
      type: 'radio',
      required: true,
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No, need quotation', value: 'need_quotation' },
        { label: 'No', value: 'no' }
      ]
    },
    {
      id: 'valuer_name',
      label: 'Valuer Name',
      type: 'text',
      required: false,
      conditional: { field: 'has_valuer', equals: 'yes' }
    },
    {
      id: 'valuer_firm',
      label: 'Valuation Firm Name',
      type: 'text',
      required: false,
      conditional: { field: 'has_valuer', equals: 'yes' }
    },
    {
      id: 'valuer_contact',
      label: 'Valuer Contact Number',
      type: 'tel',
      required: false,
      conditional: { field: 'has_valuer', equals: 'yes' }
    },
    {
      id: 'valuation_fee',
      label: 'Valuation Fee Quoted (RM)',
      type: 'currency',
      required: false,
      conditional: { field: 'has_valuer', equals: 'yes' }
    }
  ]
}
```

### 3. Enhance Co-Borrower Structure

Co-borrowers need FULL employment details, not just basic info:

```typescript
interface CoBorrowerInfo {
  // Personal Details
  title: string
  full_name: string
  ic_passport: string
  old_ic: string
  passport_expiry: string
  date_of_birth: string  // DD/MM/YYYY
  gender: string
  race: string
  bumiputra: string
  marital_status: string
  relationship: string
  no_of_dependants: string
  
  // Address & Contact
  home_address: string
  post_code: string
  city: string
  state: string
  country: string
  years_at_address: string
  correspondence_same_as_home: boolean
  correspondence_address: string
  contact_number: string
  email: string
  
  // Employment Details (NEW - Full section)
  employment_type: string
  employer_name: string
  nature_of_business: string
  occupation: string
  employer_address: string
  office_tel: string
  length_service_years: string
  length_service_months: string
  monthly_income: string
  company_establishment_date: string
  prev_employer_name: string
  prev_nature_of_business: string
  prev_occupation: string
  prev_length_service: string
}
```

### 4. Add "Render to Form" and "Save as Draft" Buttons

At the final review step, replace single "Submit" with:

```typescript
<div className="flex gap-4">
  <Button onClick={handleRenderToForm} variant="outline">
    <FileText className="w-4 h-4 mr-2" />
    Render to Form (PDF)
  </Button>
  
  <Button onClick={handleSaveDraft} variant="secondary">
    <Save className="w-4 h-4 mr-2" />
    Save as Draft
  </Button>
  
  <Button onClick={handleSubmit} disabled={!allDocumentsUploaded}>
    <Send className="w-4 h-4 mr-2" />
    Submit to Admin
  </Button>
</div>
```

### 5. Document Upload Section (Post-Signature)

After rendering form and getting client signature, add document upload section:

```typescript
{
  id: 'document_upload',
  title: 'Supporting Documents',
  description: 'Upload required documents after client signature',
  fields: [
    {
      id: 'income_documents',
      label: 'Income Documents (Payslips, EA Form, etc.)',
      type: 'file_upload',
      required: true,
      multiple: true
    },
    {
      id: 'property_documents',
      label: 'Property Documents (SPA, Title Deed, etc.)',
      type: 'file_upload',
      required: true,
      multiple: true
    },
    {
      id: 'signed_application_form',
      label: 'Signed Application Form (PDF)',
      type: 'file_upload',
      required: true
    },
    {
      id: 'valuation_report',
      label: 'Valuation Report',
      type: 'file_upload',
      required: false
    },
    {
      id: 'other_documents',
      label: 'Other Supporting Documents',
      type: 'file_upload',
      required: false,
      multiple: true
    }
  ]
}
```

### 6. Date Format Enforcement

All date fields already use `type: 'date'` which should render as DD/MM/YYYY based on browser locale. However, we need to:
- Add validation to ensure format is DD/MM/YYYY
- Add helper function to convert between formats when needed
- Display dates in DD/MM/YYYY format throughout the UI

## Implementation Priority:

### Phase 1: Critical (Must Have)
1. ✅ Reorder sections in HLB config (Personal → Employment → Financing → Property)
2. ✅ Add Lawyer & Valuer section to both HLB and OCBC configs
3. ✅ Update CoBorrowerInfo interface to include employment fields
4. ✅ Add "Save as Draft" functionality

### Phase 2: Important (Should Have)
5. ✅ Add "Render to Form" button with PDF generation
6. ✅ Add document upload section
7. ✅ Ensure all dates display as DD/MM/YYYY

### Phase 3: Enhancement (Nice to Have)
8. Add workflow status tracking (Draft → Signed → Documents Uploaded → Submitted → Admin Review → Bank Submission)
9. Add email notifications at each stage
10. Add document validation (check file types, sizes)

## Next Steps:

1. **Update HLB Config**: Reorder sections and add lawyer/valuer
2. **Update OCBC Config**: Same changes for consistency
3. **Update TypeScript Interfaces**: Add employment fields to CoBorrowerInfo
4. **Update Case Creation Page**: 
   - Add Render to Form button
   - Add Save as Draft button
   - Add document upload section
   - Implement PDF generation
5. **Update Database Schema**: Add fields for lawyer, valuer, document paths
6. **Test Complete Workflow**: From calculation → case creation → draft → render → sign → upload → submit

## Estimated Effort:

- **Phase 1**: 2-3 hours (config updates + interface changes)
- **Phase 2**: 4-6 hours (PDF generation + file upload implementation)
- **Phase 3**: 8-12 hours (workflow management + notifications)

**Total**: 14-21 hours for complete implementation
