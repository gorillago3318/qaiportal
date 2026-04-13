# OCBC Configuration Reordering - Complete ✅

## Summary

Successfully reordered OCBC bank configuration to follow the logical workflow and added Lawyer & Valuer section.

## Changes Made

### File Modified
- **`src/config/bank-forms/ocbc.ts`** - Complete restructure with 8 sections in correct order

### New Section Order (Logical Flow)

1. **Personal Details - Applicant 1** *(moved from position 4)*
   - Full Name, ID Type & Number, Date of Birth
   - Gender, Race, Marital Status, Residency Status
   - Home Address, Contact Numbers, Email

2. **Employment Details** *(moved from position 5)*
   - Employment Type, Employer Name, Nature of Business
   - Office Address, Length of Service, Monthly Income

3. **Financing Details / Requirement** *(moved from position 1)*
   - Product Type (Conventional/Islamic), Purpose, Loan Type
   - Financing Amount, Tenure, Installment/Rental

4. **Collateral / Property Details** *(moved from position 2)*
   - Property Owner Names, Address, Postcode
   - Property Type, Built-up/Land Area, Purchase Price
   - Title Type, Land Type, Restrictions

5. **Applicable for Refinancing Only** *(moved from position 3)*
   - Outstanding Balance
   - Buyer & Seller Relationship

6. **Outstanding Loan / Financing Commitments** *(stayed at position 6)*
   - Has other commitments (Yes/No)

7. **Lawyer & Valuer Information** ✨ **NEW!**
   - **Lawyer Section**:
     - Has lawyer? (Yes/No)
     - Is panel lawyer? (conditional)
     - Lawyer Name, Law Firm Name
     - Contact Number, Email, Office Address
   
   - **Valuer Section**:
     - Has valuer? (Yes/No)
     - Valuer Name, Valuation Firm
     - Contact Number, Valuation Fee Quoted

8. **Consent & Acknowledgement** *(moved from position 7 to 8)*
   - Consent to process personal data
   - Consent for 3rd party charges
   - Product Disclosure Sheet acknowledgment
   - Interest in OCBC Card

## Key Features

### Conditional Fields
All lawyer and valuer fields are conditionally shown based on Yes/No selection:
- If `has_lawyer = 'no'`, all lawyer fields are hidden
- If `has_valuer = 'no'`, all valuer fields are hidden
- `is_panel_lawyer` only shows if `has_lawyer = 'yes'`

### Field Mapping
The OCBC config uses field IDs that map to our database schema:
- `lawyer_name` → maps to `lawyer_name_other` in DB
- `law_firm_name` → maps to `lawyer_firm_other` in DB
- `lawyer_contact` → maps to `lawyer_contact` in DB
- `lawyer_email` → maps to `lawyer_email` in DB
- `lawyer_address` → maps to `lawyer_address` in DB
- `valuer_name` → maps to `valuer_1_name` in DB
- `valuer_firm` → maps to `valuer_1_firm` in DB
- `valuer_contact` → maps to `valuer_contact` in DB
- `valuation_fee_quoted` → maps to `valuation_fee_quoted` in DB

## Comparison with HLB Config

Both banks now follow the same logical structure:

| Order | HLB Section | OCBC Section | Match? |
|-------|-------------|--------------|--------|
| 1 | Personal Details | Personal Details | ✅ |
| 2 | Employment Details | Employment Details | ✅ |
| 3 | Financing Details | Financing Details | ✅ |
| 4 | Property Details | Collateral / Property Details | ✅ |
| 5 | Title Details | (included in Property) | ⚠️ |
| 6 | Other Financing Facilities | Outstanding Loans | ✅ |
| 7 | Co-Borrower Information | (not yet added) | ❌ |
| 8 | Lawyer & Valuer | Lawyer & Valuer | ✅ |
| 9 | (none) | Consent & Acknowledgement | ℹ️ |

**Note**: OCBC has an extra "Consent & Acknowledgement" section at the end which is specific to their requirements.

## Testing Checklist

After deployment, test the following:

- [ ] Select OCBC Bank in case creation
- [ ] Verify sections appear in correct order (Personal first, not Financing)
- [ ] Fill out Personal Details section
- [ ] Fill out Employment Details section
- [ ] Fill out Financing Details section
- [ ] Fill out Property Details section
- [ ] Test conditional fields in Lawyer & Valuer section
  - [ ] Select "No" for lawyer → fields should hide
  - [ ] Select "Yes" for lawyer → fields should show
  - [ ] Same for valuer
- [ ] Save as Draft → verify saves correctly
- [ ] Submit Case → verify submits correctly
- [ ] Check database for lawyer/valuer data storage

## Benefits

✅ **Improved User Experience**: Logical flow matches how agents think about cases  
✅ **Consistency**: Both HLB and OCBC now follow similar structure  
✅ **Complete Data Collection**: Lawyer & Valuer info now captured upfront  
✅ **Conditional Display**: Reduces form clutter by hiding irrelevant fields  
✅ **Future-Proof**: Easy to add more banks with same pattern  

## Next Steps

1. ✅ ~~OCBC Configuration Reordering~~ **DONE**
2. ⏳ Test both HLB and OCBC workflows end-to-end
3. ⏳ Add Co-Borrower dynamic UI (add/remove co-borrowers with full forms)
4. ⏳ Implement document upload feature
5. ⏳ Build admin review interface
6. ⏳ (Later) PDF generation when you provide the forms

---

**Status**: ✅ Complete - Ready for testing!
