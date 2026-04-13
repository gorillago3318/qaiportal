# Quick Start Guide - Testing Official PDF Forms

## 🚀 Immediate Testing Steps

### Step 1: Verify Setup
```bash
# Check if pdf-lib is installed
npm list pdf-lib

# Should show: pdf-lib@x.x.x

# Verify PDF files exist
dir Forms
# Should show:
# HONG LEONG BANK APPLICATION FORM.pdf
# OCBC APPLICATION FORM 0225.pdf
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Inspect PDF Field Names (IMPORTANT!)

Before the forms will work, we need to know the actual field names in your PDFs.

**Open browser and navigate to:**
```
http://localhost:3000/api/inspect-pdf?bank=hong_leong_bank
```

This will return JSON showing all form fields. **Save this output!**

Example response:
```json
{
  "bank": "hong_leong_bank",
  "totalFields": 45,
  "fields": [
    { "name": "txtClientName", "type": "PDFTextField" },
    { "name": "txtICNumber", "type": "PDFTextField" },
    { "name": "txtDOB", "type": "PDFTextField" },
    ...
  ]
}
```

**Do the same for OCBC:**
```
http://localhost:3000/api/inspect-pdf?bank=ocbc
```

### Step 4: Create Test Case

1. Login to your application
2. Go to Agent → Cases → New Case
3. Select Hong Leong Bank
4. Fill in ALL sections with test data:
   - Client Info: John Doe, IC: 900101-10-1234, etc.
   - Employment: Employer ABC, Income: 5000, etc.
   - Financing: Amount 500000, Tenure 30 years, etc.
   - Property: Address, Type, Price, etc.
   - Lawyer: Name, Firm, Contact (optional)
   - Valuer: Name, Firm, Fee (optional)
5. Click "Render to Form (PDF)"

### Step 5: Download Official Form

In the print preview modal:
1. Click **"Download Official Form"** button (navy blue)
2. Wait for loading spinner
3. PDF should download automatically
4. Filename: `Application_Form_CASE-XXX.pdf`

### Step 6: Verify PDF

Open the downloaded PDF and check:
- ✅ Are fields filled with your test data?
- ✅ Is formatting correct (dates, currency)?
- ✅ Are all sections present?

**If fields are EMPTY**, see troubleshooting below.

---

## 🔧 Troubleshooting

### Problem: Fields are empty in downloaded PDF

**Cause**: The field names in our code don't match the actual field names in your PDF.

**Solution**:

1. **Check the inspect output** from Step 3 above
2. **Compare field names**:
   - Our code uses: `client_name`, `client_ic`, `financing_amount`
   - Your PDF might have: `txtClientName`, `txtICNo`, `numLoanAmount`
   
3. **Update the mapping** in `src/app/api/generate-pdf/route.ts`:

```typescript
// OLD (our assumed names)
fillTextField('client_name', data.client_name)
fillTextField('client_ic', data.client_ic)

// NEW (actual PDF field names from inspect output)
fillTextField('txtClientName', data.client_name)
fillTextField('txtICNo', data.client_ic)
```

4. **Save and restart dev server**
5. **Try downloading again**

### Problem: "Bank form template not found"

**Solution**:
```bash
# Check if Files folder exists
dir Forms

# If missing, create it and copy PDFs:
mkdir Forms
# Then manually copy your PDF files into qaiportal/Forms/
```

### Problem: "Failed to generate PDF"

**Check**:
1. Browser console (F12 → Console tab)
2. Terminal where `npm run dev` is running
3. Look for error messages

Common causes:
- Case ID is invalid
- Database connection issue
- PDF file is corrupted
- Permission issues

### Problem: Download doesn't start

**Check**:
1. Browser console for JavaScript errors
2. Network tab (F12 → Network) for failed API calls
3. Verify case has an ID (not a draft without saving)

---

## 📋 Field Mapping Template

Use this template to map your PDF fields. After running the inspect endpoint, fill in the right column:

### Hong Leong Bank

| Our Code Name | Actual PDF Field Name | Status |
|---------------|----------------------|--------|
| client_title | ? | ⏳ |
| client_name | ? | ⏳ |
| client_ic | ? | ⏳ |
| old_ic | ? | ⏳ |
| client_dob | ? | ⏳ |
| gender | ? | ⏳ |
| race | ? | ⏳ |
| marital_status | ? | ⏳ |
| residency_status | ? | ⏳ |
| home_address | ? | ⏳ |
| post_code | ? | ⏳ |
| city | ? | ⏳ |
| state | ? | ⏳ |
| contact_number | ? | ⏳ |
| client_email | ? | ⏳ |
| employment_type | ? | ⏳ |
| monthly_income | ? | ⏳ |
| employer_name | ? | ⏳ |
| nature_of_business | ? | ⏳ |
| occupation | ? | ⏳ |
| office_address | ? | ⏳ |
| office_tel | ? | ⏳ |
| length_service_years | ? | ⏳ |
| length_service_months | ? | ⏳ |
| product_type | ? | ⏳ |
| purpose | ? | ⏳ |
| financing_amount | ? | ⏳ |
| tenure_years | ? | ⏳ |
| interest_rate | ? | ⏳ |
| loan_type | ? | ⏳ |
| property_owner_names | ? | ⏳ |
| property_address | ? | ⏳ |
| property_postcode | ? | ⏳ |
| property_type | ? | ⏳ |
| buildup_area | ? | ⏳ |
| land_area | ? | ⏳ |
| purchase_price | ? | ⏳ |
| type_of_purchase | ? | ⏳ |
| title_type | ? | ⏳ |
| land_type | ? | ⏳ |
| lawyer_name | ? | ⏳ |
| law_firm_name | ? | ⏳ |
| lawyer_contact | ? | ⏳ |
| lawyer_email | ? | ⏳ |
| lawyer_address | ? | ⏳ |
| valuer_name | ? | ⏳ |
| valuer_firm | ? | ⏳ |
| valuer_contact | ? | ⏳ |
| valuation_fee_quoted | ? | ⏳ |

---

## 💡 Pro Tips

### Tip 1: Use Browser DevTools
Open F12 → Network tab → Filter by "generate-pdf"
- See the exact API request
- Check response status
- View any error messages

### Tip 2: Test Incrementally
Don't try to map all 50+ fields at once. Start with:
1. Just client name and IC
2. Test download
3. If works, add more fields
4. Repeat until all mapped

### Tip 3: Keep Backup
Before making changes to `generate-pdf/route.ts`:
```bash
copy src\app\api\generate-pdf\route.ts src\app\api\generate-pdf\route.ts.backup
```

### Tip 4: Log Everything
Add console logs to debug:
```typescript
console.log('Case data:', data)
console.log('Attempting to fill field:', fieldName, 'with value:', value)
```

### Tip 5: Check PDF Manually
Open the PDF in Adobe Acrobat or similar:
- Prepare Form tool shows all field names
- Verify fields are actually form fields (not just text)
- Check if fields are read-only or editable

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ Click "Download Official Form" 
2. ✅ See loading spinner briefly
3. ✅ PDF downloads automatically
4. ✅ Open PDF and see your test data filled in
5. ✅ All major sections have data
6. ✅ Formatting looks professional
7. ✅ Can print the PDF
8. ✅ Ready to send to client!

---

## 🆘 Need Help?

If you're stuck:

1. **Share the inspect output** - Copy JSON from `/api/inspect-pdf`
2. **Share error messages** - From browser console or terminal
3. **Describe what happens** - What do you see vs what you expect?
4. **Share a screenshot** - Of the downloaded PDF (if it opens but is empty)

I can then help you map the fields correctly!

---

**Ready to test?** Start with Step 1 and let me know how it goes! 🚀
