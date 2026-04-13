# ⚡ QUICK START - Lawyer Commission Workflow

## 🎯 What We're Building

Complete lawyer commission management system with:
- Agent selects panel/non-panel lawyer during case creation
- Track special arrangement discounts from panel lawyers
- Admin can manage which lawyers are panel for which banks
- Automatic audit trail for all financial amendments
- Commission calculated after case "accepted" status

---

## 🔴 STEP 1: RUN THIS SQL IN SUPABASE (RIGHT NOW)

**Go to:** Supabase Dashboard → SQL Editor

**Copy and paste this file:**
```
supabase/migrations/011_lawyer_commission_enhancement.sql
```

**Click "Run"**

**Then verify:**
```
supabase/migrations/VERIFY_MIGRATION_011.sql
```

You should see ✅ for all checks.

---

## 📝 STEP 2: WHAT CHANGED IN DATABASE

### New Column in `cases` table:
```sql
special_arrangement_discount NUMERIC(12,2) DEFAULT 0
```

### New Table: `case_amendment_log`
Tracks who changed what financial fields and when:
- `lawyer_professional_fee` changes
- `special_arrangement_discount` changes
- `has_lawyer_discount` changes
- `lawyer_discount_amount` changes

### Existing Table: `lawyer_bank_associations`
Links lawyers to banks they're panel for (created by migration 010 or 011)

### Sample Data Inserted:
- LWZ & Associates (panel for HLB + OCBC)
- Y&R Legal Chambers (panel for HLB + OCBC)

---

## 💻 STEP 3: CODE TO IMPLEMENT

See full guide: `LAWYER_COMMISSION_IMPLEMENTATION_GUIDE.md`

**Key files to modify:**
1. `src/app/agent/cases/new/page.tsx` - Add Step 4: Lawyer Selection
2. `src/app/admin/settings/page.tsx` - Add bank checkboxes for lawyers
3. `src/app/api/cases/route.ts` - Handle new lawyer fields
4. `src/app/api/cases/[id]/commission/route.ts` - Use special_arrangement_discount in calculation

---

## 🧪 STEP 4: TEST IT

### Agent Flow:
1. Create new case → Select HLB
2. Fill client info (Steps 1-3)
3. **Step 4: Lawyer Selection appears**
   - Choose "Panel Lawyer"
   - Select "Lee Wei Zhen - LWZ & Associates" from dropdown
   - Enter professional fee: 6250.00
   - Check "Special Arrangement" → Enter discount: 500.00
4. Continue to bank forms
5. Save as Draft
6. Check database: All fields saved correctly

### Admin Flow:
1. Go to Settings → Panel Lawyers
2. See LWZ and Y&R listed
3. Check/uncheck bank associations
4. Changes save immediately

### Amendment Tracking:
1. Manually update a case's `lawyer_professional_fee` in database
2. Check `case_amendment_log` table
3. See entry with old_value, new_value, amended_by, timestamp

---

## 📊 COMMISSION FORMULA

```
Net Fee = lawyer_professional_fee - special_arrangement_discount
QAI Share (70%) = Net Fee × 0.70
Company Cut (10%) = QAI Share × 0.10
Net Distributable = QAI Share - Company Cut

Then distribute according to tier percentages
```

**Example:**
- Professional Fee: RM 6,250.00
- Special Discount: RM 500.00
- Net Fee: RM 5,750.00
- QAI Share (70%): RM 4,025.00
- Company Cut (10%): RM 402.50
- Net Distributable: RM 3,622.50

Agent gets their tier % of RM 3,622.50

---

## ❓ TROUBLESHOOTING

### "Column special_arrangement_discount does not exist"
→ Migration 011 didn't run. Run it now.

### "No panel lawyers in dropdown"
→ Check `lawyer_bank_associations` table has entries for selected bank
→ Verify lawyers have `is_panel = true` and `is_active = true`

### "Amendment log not recording changes"
→ Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trg_log_financial_amendments'`
→ Trigger only fires on UPDATE, not INSERT

### "Bank associations not showing in admin"
→ Make sure you ran migration 011 (creates table if missing)
→ Check browser console for errors

---

## 🎯 BUSINESS RULES

✅ **Panel Lawyers:**
- Generate commission for agents
- Must select from dropdown (based on bank association)
- Professional fee required
- Can have special arrangement discount

✅ **Non-Panel Lawyers:**
- NO commission generated
- Manual entry of name/firm/contact
- No professional fee tracking needed

✅ **Special Arrangement:**
- Only for panel lawyers
- Reduces commissionable amount
- Tracked separately for transparency
- Admin can adjust later if client negotiates at signing

✅ **Audit Trail:**
- All financial field changes logged automatically
- Shows who changed, what changed, old value, new value, when
- Visible in `case_amendment_log` table

---

## 📞 NEED HELP?

Check these files:
- Full implementation guide: `LAWYER_COMMISSION_IMPLEMENTATION_GUIDE.md`
- SQL migration: `supabase/migrations/011_lawyer_commission_enhancement.sql`
- Verification script: `supabase/migrations/VERIFY_MIGRATION_011.sql`

---

**Ready? Run the migration first!** 🚀
