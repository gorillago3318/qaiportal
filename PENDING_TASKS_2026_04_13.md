# 📋 PENDING TASKS & NEXT STEPS

**Date:** 2026-04-13  
**Current Status:** Core case creation flow fixed, but several key features remain incomplete.

---

## 🔴 HIGH PRIORITY (Must Complete Next)

### **1. Run Migration 010 in Supabase**
**File:** `supabase/migrations/010_lawyer_bank_associations.sql`  
**Status:** Created but NOT RUN  

**Action:**
- Go to Supabase Dashboard → SQL Editor
- Copy/paste contents of `010_lawyer_bank_associations.sql`
- Execute

**What it adds:**
- `lawyer_bank_associations` table (links lawyers to specific banks)
- Second valuer fields (`valuer_2_name`, `valuer_2_firm`, etc.)
- Auto case_code generation trigger (format: CASE-2026-00001)
- Sample panel lawyers: LWZ & Associates, Y&R Legal Chambers

**Verify:**
```sql
SELECT * FROM lawyer_bank_associations;
SELECT id, name, firm FROM lawyers WHERE is_panel = true;
```

---

### **2. Implement Lawyer Selection UI (Step 4)**
**Location:** `src/app/agent/cases/new/page.tsx`  
**Status:** Not Started  

**Requirements:**
- Add as Step 4 in wizard (after Co-Borrowers, before Bank Forms)
- Dropdown with two options:
  1. **Panel Lawyers** - Fetch from database based on selected bank
  2. **Others (Non-Panel)** - Manual entry
  
**Conditional Fields:**
- If Panel selected: Show dropdown of available lawyers + professional fee input
- If Others selected: Show text inputs for name, firm, contact, email

**Data Storage (in `bank_form_data` JSONB):**
```typescript
// Panel lawyer
{
  selected_lawyer: 'panel',
  lawyer_id: 'uuid',
  lawyer_professional_fee: 1500.00
}

// Non-panel
{
  selected_lawyer: 'others',
  lawyer_name_other: 'John Doe',
  lawyer_firm_other: 'ABC Legal',
  lawyer_contact_other: '+60123456789',
  lawyer_email_other: 'john@abc.com'
}
```

**Files to Modify:**
- `src/app/agent/cases/new/page.tsx` - Add step, state, validation
- Possibly create `src/components/lawyer-selection.tsx` (optional)

---

### **3. Add Valuer 2 Section**
**Location:** Within bank-specific forms or as separate step  
**Status:** Database fields added (migration 010), UI not started  

**Requirements:**
- Most banks require 2 verbal valuations
- Add fields for second valuer:
  - Name, Firm, Contact, Email
  - Valuation Date, Indicative Value
  - Fee Quoted, Report Received

**Implementation Options:**
- **Option A:** Add to each bank's form config (hlb.ts, ocbc.ts)
- **Option B:** Create separate "Valuers" step in wizard
- **Option C:** Add as subsection within Property Details

**Recommendation:** Option A (keep with existing valuer fields in bank forms)

---

## 🟡 MEDIUM PRIORITY (Important but Can Wait)

### **4. Test Render to PDF Button**
**Status:** Implemented but untested  

**Issue:**
- Button only appears after successful save
- Saves were failing before JSONB fix
- Now should work, but needs verification

**Test Steps:**
1. Create new case
2. Fill all required fields
3. Click "Save as Draft"
4. Verify redirect to `/agent/cases`
5. Open saved case
6. Look for "Render to PDF" button
7. Click and verify CasePrintView opens
8. Test print/download functionality

**If still not working:**
- Check console for errors
- Verify `savedCaseData` is being set correctly
- Check if CasePrintView component receives correct data

---

### **5. Automated Lawyer Email Notifications**
**Status:** Not Started  

**Trigger:** When draft case is saved with lawyer selected  

**Email Template:**
```
Subject: Request for Quotation LA - Case #[CASE_CODE]

Client Name: [client_name]
No. of Borrower: [count]
1st/3rd Party: [loan_purpose]

Financing Type: [product_type]
Property Details: [property_type]
Land Tenure: [land_tenure]
Title Type: [title_type]
State: [property_state]
Bank: [selected_bank]
Loan Amount: RM[facility_amount]

Special Remark: [notes]

Please reply with your professional fee quotation.
Case Reference: [CASE_CODE]
```

**Implementation:**
- Create Edge Function: `supabase/functions/notify-lawyer/index.ts`
- Or API Route: `src/app/api/notify-lawyer/route.ts`
- Use Resend or similar email service
- Trigger on case save when `lawyer_id` or `lawyer_name_other` is set
- Include case_code for tracking replies

**Dependencies:**
- Need email service API key (Resend, SendGrid, etc.)
- Configure environment variables

---

### **6. Document Upload Interface**
**Status:** Not Started  

**Purpose:** Upload and organize case documents  

**Document Categories:**
- Income Documents (payslips, EA form, bank statements)
- Property Documents (SPA, title deed, assessment)
- Signed Application Form
- Valuation Report
- Other Documents

**Storage:**
- Upload to Supabase Storage bucket: `case-documents`
- Store URLs in `cases.documents` JSONB field
- Structure:
  ```json
  {
    "income_documents": ["url1", "url2"],
    "property_documents": ["url3"],
    "signed_application_form": "url4",
    "valuation_report": "url5",
    "other_documents": ["url6"]
  }
  ```

**UI Components Needed:**
- File upload dropzone
- Document category selector
- Preview/thumbnail display
- Delete/rename functionality
- Progress indicators

**Files to Create:**
- `src/components/document-uploader.tsx`
- `src/app/agent/cases/[id]/documents/page.tsx` (dedicated page)
- Or modal within case detail view

---

### **7. Case Status Workflow UI**
**Status:** Enums exist, UI not implemented  

**Status Flow:**
```
draft → pending_signature → documents_uploaded → submitted → admin_review → bank_submission
```

**Requirements:**
- Display current status prominently in case detail
- Allow status transitions with buttons/dropdown
- Admin-only actions for review/approval steps
- Track status history in `case_status_history` table
- Show who changed status and when

**UI Locations:**
- Case detail page header (status badge)
- Admin dashboard (filter by status)
- Status change modal (with notes/comments)

**Files to Modify:**
- `src/app/agent/cases/[id]/page.tsx` - Add status display/controls
- `src/app/admin/cases/page.tsx` - Add status filters

---

## 🟢 LOW PRIORITY (Nice to Have)

### **8. Commission Calculation Integration**
**Status:** Database structure exists, calculation logic not implemented  

**Logic:**
- Panel lawyers (`is_panel=true`) → eligible for commission
- Commission calculated from `lawyer_professional_fee`
- Formula: `commission = professional_fee × agent_commission_rate`
- Agent rate based on tier (from `commission_tier_config` table)

**Implementation:**
- Create commission record when case status = 'submitted' or 'bank_submission'
- Calculate gross amount, company cut, net distributable
- Store in `commissions` table
- Display in agent dashboard

**Files to Create:**
- `src/lib/commission-calculator.ts` - Calculation logic
- Edge Function or API route to auto-create commissions

---

### **9. Case Search & Filtering**
**Status:** Basic list exists, advanced search missing  

**Features Needed:**
- Search by case_code, client name, IC number
- Filter by status, bank, date range
- Sort by created_at, status, loan amount
- Export to CSV/Excel

**UI:**
- Search bar at top of cases list
- Filter sidebar or dropdown menu
- Column sorting on table headers

**Files to Modify:**
- `src/app/agent/cases/page.tsx` - Add search/filter controls
- Update API route to support query parameters

---

### **10. Notification System**
**Status:** Table exists, no UI or triggers  

**Notifications For:**
- Case status changes
- New comments on cases
- Document uploads
- Commission payouts
- Admin approvals

**Implementation:**
- Create notifications on relevant events (triggers or API calls)
- Notification bell icon in header
- Notification center page
- Mark as read/unread functionality
- Email notifications (optional)

**Files to Create:**
- `src/components/notification-bell.tsx`
- `src/app/notifications/page.tsx`
- Database triggers or Edge Functions

---

### **11. Co-Borrower Enhancements**
**Status:** Basic implementation done  

**Potential Improvements:**
- Support more than 1 co-borrower (currently limited to 1)
- Co-borrower income verification documents
- Relationship validation (spouse, parent, sibling, etc.)
- Joint income calculation display

---

### **12. Bank-Specific Form Enhancements**
**Status:** HLB and OCBC configs exist  

**Remaining Banks:**
- Maybank
- CIMB
- RHB
- Public Bank
- AmBank
- etc.

**Task:**
- Create form configs for other banks
- Follow same pattern as HLB/OCBC
- Add conditional logic as needed

**Files to Create:**
- `src/config/bank-forms/maybank.ts`
- `src/config/bank-forms/cimb.ts`
- etc.

---

## 📊 COMPLETION STATUS OVERVIEW

| Feature | Database | Backend | Frontend | Testing | Overall |
|---------|----------|---------|----------|---------|---------|
| **Core Case Creation** | ✅ | ✅ | ✅ | ⚠️ | 90% |
| **JSONB Storage Fix** | ✅ | ✅ | ✅ | ⚠️ | 95% |
| **Items 5-9** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Validation System** | ✅ | ✅ | ✅ | ✅ | 100% |
| **Lawyer Selection** | ✅ | ❌ | ❌ | ❌ | 20% |
| **Valuer 2 Fields** | ✅ | ❌ | ❌ | ❌ | 20% |
| **Render to PDF** | ✅ | ✅ | ✅ | ❌ | 80% |
| **Email Notifications** | ❌ | ❌ | ❌ | ❌ | 0% |
| **Document Upload** | ✅ | ❌ | ❌ | ❌ | 15% |
| **Status Workflow** | ✅ | ❌ | ❌ | ❌ | 20% |
| **Commission Calc** | ✅ | ❌ | ❌ | ❌ | 15% |
| **Search & Filter** | ✅ | ⚠️ | ❌ | ❌ | 30% |

---

## 🎯 RECOMMENDED ORDER OF EXECUTION

### **Phase 1: Complete Core Workflow (This Week)**
1. ✅ Run Migration 010
2. ✅ Implement Lawyer Selection UI
3. ✅ Add Valuer 2 fields to UI
4. ✅ Test end-to-end save flow
5. ✅ Test Render to PDF

**Outcome:** Fully functional case creation from start to PDF generation

---

### **Phase 2: Automation & Efficiency (Next Week)**
6. Implement automated lawyer email notifications
7. Build document upload interface
8. Add case status workflow UI
9. Test complete workflow with real users

**Outcome:** Reduced manual work, better tracking

---

### **Phase 3: Advanced Features (Following Weeks)**
10. Commission calculation automation
11. Advanced search & filtering
12. Notification system
13. Additional bank form configs

**Outcome:** Scalable, feature-rich platform

---

## 🛠️ TECHNICAL DEBT & KNOWN ISSUES

### **Issue #1: TypeScript Errors**
- Some Supabase type mismatches expected
- Generally safe to ignore if functionality works
- Can be fixed with proper type generation later

### **Issue #2: Error Messages**
- Currently using basic `alert()` dialogs
- Should migrate to toast notifications (sonner/react-hot-toast)
- Better UX for success/error feedback

### **Issue #3: Loading States**
- Some operations lack loading indicators
- Add spinners/skeletons for better perceived performance

### **Issue #4: Mobile Responsiveness**
- Forms may not be fully optimized for mobile
- Test on various screen sizes
- Adjust layouts as needed

---

## 📝 QUICK REFERENCE FOR NEW CHAT

**To continue work, paste this file and say:**
> "Let's start with [TASK NUMBER]. Here's what we need to do..."

**Example:**
> "Let's start with Task #1. I've run migration 010 in Supabase. Now implement the lawyer selection UI as Step 4."

**Key Context:**
- All form data stored in `cases.bank_form_data` JSONB
- Panel lawyers fetched based on selected bank
- Commission eligibility tied to `is_panel` flag
- Case codes auto-generated: CASE-YYYY-XXXXX
- Git commits pushed after each milestone

---

## 🔗 IMPORTANT FILE PATHS

**Core Files:**
- Case Creation: `src/app/agent/cases/new/page.tsx`
- Dynamic Forms: `src/components/dynamic-bank-form.tsx`
- Bank Configs: `src/config/bank-forms/hlb.ts`, `ocbc.ts`
- Print View: `src/components/case-print-view.tsx`
- Cases List: `src/app/agent/cases/page.tsx`

**Database:**
- Migrations: `supabase/migrations/`
- Schema: `supabase/migrations/001_initial_schema.sql`
- Latest: `supabase/migrations/010_lawyer_bank_associations.sql`

**Documentation:**
- Session Summary: `SESSION_SUMMARY_2026_04_13.md`
- Continuation Guide: `CONTINUE_FROM_HERE_LAWYER_BANK.md`
- This File: `PENDING_TASKS_2026_04_13.md`

---

**Last Updated:** 2026-04-13  
**Next Action:** Run Migration 010 → Implement Lawyer Selection UI
