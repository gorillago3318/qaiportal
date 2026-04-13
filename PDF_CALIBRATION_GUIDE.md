# PDF Field Position Calibration Guide

## 🎯 Goal

Get your bank forms **filled up neatly** with case data overlaid at the correct positions.

---

## 📋 Current Status

✅ System is ready to fill PDFs  
✅ Field position configuration structure in place  
⚠️ **Positions need calibration** - Current values are examples  

---

## 🔧 How to Calibrate Positions

### Step 1: Create a Test Case

1. Login to your system
2. Create a new case (HLB or OCBC)
3. Fill in ALL fields with distinctive test data:
   - Name: "TEST NAME JOHN DOE"
   - IC: "900101-10-1234"
   - Income: "5000"
   - Loan Amount: "500000"
   - etc.
4. Save the case

### Step 2: Download the Filled PDF

1. Click "Render to Form (PDF)"
2. Click "Download Official Form"
3. Open the downloaded PDF

### Step 3: Measure Where Text Appears

Open the PDF and note where each field's text appears vs where it SHOULD appear.

**Example:**
- "TEST NAME JOHN DOE" appears at position (180, 680)
- But the form's name field is actually at position (200, 700)
- **Adjustment needed**: Change `client_name: { x: 180, y: 680 }` to `client_name: { x: 200, y: 700 }`

### Step 4: Update Positions in Code

Open `src/app/api/generate-pdf/route.ts` and find the `FIELD_POSITIONS` object:

```typescript
const FIELD_POSITIONS = {
  hong_leong_bank: {
    client_title: { x: 120, y: 680 },     // ← Adjust these numbers
    client_name: { x: 180, y: 680 },      // ← Adjust these numbers
    client_ic: { x: 120, y: 660 },        // ← Adjust these numbers
    // ... more fields
  },
  ocbc: {
    // Similar for OCBC
  }
}
```

**Coordinate System:**
- **X**: Distance from LEFT edge (0 = far left, higher = move right)
- **Y**: Distance from BOTTOM edge (0 = bottom, higher = move up)

**To move text:**
- Move RIGHT → Increase X
- Move LEFT → Decrease X
- Move UP → Increase Y
- Move DOWN → Decrease Y

### Step 5: Test Again

1. Save the file
2. Restart dev server if needed (`npm run dev`)
3. Download PDF again
4. Check if text is now in the right place
5. Repeat until all fields align perfectly

---

## 💡 Pro Tips for Calibration

### Tip 1: Use Grid Paper Method

Print your blank bank form on grid paper (or overlay a grid in Photoshop/GIMP):
- Count squares from left edge → X coordinate
- Count squares from bottom edge → Y coordinate
- Each square = ~10 units

### Tip 2: Calibrate One Section at a Time

Don't try to fix all 50+ fields at once. Start with:
1. Personal Details section (top of form)
2. Get those 10-15 fields perfect
3. Then move to Employment section
4. Continue section by section

### Tip 3: Use Distinctive Test Data

Use unique values that are easy to spot:
- Name: "AAAAAAAA BBBBBBBB"
- IC: "111111-11-1111"
- Amount: "999999"

This makes it obvious which text belongs to which field.

### Tip 4: Add Debug Markers (Optional)

Temporarily add visual markers to see coordinates:

```typescript
// Add this after drawing all fields (temporary debug aid)
firstPage.drawRectangle({
  x: 50,
  y: 50,
  width: 10,
  height: 10,
  color: rgb(1, 0, 0), // Red marker at (50, 50)
})
firstPage.drawText('(50,50)', { x: 65, y: 50, size: 8, color: rgb(1, 0, 0) })
```

### Tip 5: Document Your Positions

Keep a spreadsheet or note file with final positions:

| Field Name | HLB X | HLB Y | OCBC X | OCBC Y | Notes |
|------------|-------|-------|--------|--------|-------|
| client_name | 200 | 700 | 210 | 710 | Bold font |
| client_ic | 200 | 680 | 210 | 690 | - |
| monthly_income | 300 | 400 | 310 | 410 | RM format |

---

## 📊 Example Calibration Process

### Before Calibration:
```typescript
client_name: { x: 180, y: 680 }
```
**Result**: Text appears too far left and too low

### After Measuring:
- Need to move RIGHT by 20 units → X: 180 + 20 = 200
- Need to move UP by 20 units → Y: 680 + 20 = 700

### After Calibration:
```typescript
client_name: { x: 200, y: 700 }
```
**Result**: Text aligns perfectly with the form field! ✅

---

## 🎨 Advanced Formatting Options

### Bold Text
```typescript
drawFieldText('client_name', value, { bold: true })
```

### Larger Font
```typescript
drawFieldText('financing_amount', value, { size: 12 })
```

### Different Color
```typescript
drawFieldText('status', 'APPROVED', { 
  color: rgb(0, 0.6, 0) // Green
})
```

### Multi-line Address
```typescript
property_address: { x: 120, y: 600, maxWidth: 400 }
// Text will wrap automatically within 400 units width
```

---

## 🔄 Iterative Calibration Workflow

```
1. Set initial positions (guess based on form layout)
   ↓
2. Generate PDF with test data
   ↓
3. Open PDF and check alignment
   ↓
4. Note which fields are misaligned
   ↓
5. Calculate adjustment needed
   ↓
6. Update FIELD_POSITIONS in code
   ↓
7. Generate PDF again
   ↓
8. Repeat steps 3-7 until perfect
```

**Typical iterations per field**: 2-4 attempts  
**Total time for full form**: 1-2 hours  

---

## 📝 Common Adjustments

### Text Too High
```typescript
// BEFORE
client_name: { x: 180, y: 700 }

// AFTER (move down by decreasing Y)
client_name: { x: 180, y: 680 }
```

### Text Too Far Right
```typescript
// BEFORE
client_ic: { x: 250, y: 660 }

// AFTER (move left by decreasing X)
client_ic: { x: 220, y: 660 }
```

### Text Overlapping Next Field
```typescript
// BEFORE (address too wide, overlaps next field)
home_address: { x: 120, y: 600 }

// AFTER (add maxWidth to wrap text)
home_address: { x: 120, y: 600, maxWidth: 350 }
```

---

## ✅ Success Criteria

You'll know calibration is complete when:

1. ✅ All text appears inside the correct form boxes/lines
2. ✅ No overlapping between fields
3. ✅ Multi-line fields (addresses) wrap correctly
4. ✅ Currency amounts formatted properly (RM X,XXX.XX)
5. ✅ Dates in DD/MM/YYYY format
6. ✅ Bold/emphasized fields stand out appropriately
7. ✅ Looks like a professionally filled form

---

## 🚀 Quick Start Calibration

**Fastest way to calibrate:**

1. **Start with just 3 fields**:
   ```typescript
   client_name: { x: ?, y: ? }
   client_ic: { x: ?, y: ? }
   financing_amount: { x: ?, y: ? }
   ```

2. **Generate PDF and check**

3. **Adjust those 3 until perfect**

4. **Add 5 more fields**

5. **Repeat until all fields done**

This incremental approach prevents overwhelm and ensures accuracy.

---

## 🆘 Troubleshooting

### Problem: Text not appearing at all
**Check**:
- Field has a value (not null/empty)
- Position is within page bounds (X: 0-600, Y: 0-800 for A4)
- No JavaScript errors in console

### Problem: Text appearing on wrong page
**Solution**: Specify which page to draw on:
```typescript
const secondPage = pages[1] // Get page 2
secondPage.drawText(value, { x, y })
```

### Problem: Text cut off
**Solution**: Add maxWidth or reduce font size:
```typescript
home_address: { x: 120, y: 600, maxWidth: 350 }
// or
drawFieldText('address', value, { size: 9 })
```

### Problem: Can't get alignment perfect
**Solution**: 
- Use smaller adjustments (change by 5 units at a time)
- Print the form and measure with ruler
- Take screenshot and measure in image editor

---

## 📞 Need Help?

If you're stuck:
1. Generate a PDF with test data
2. Take a screenshot showing misalignment
3. Share which fields need adjustment
4. I can help calculate the correct positions!

---

**Ready to calibrate?** Start with Step 1 and let's get those forms filled neatly! 🎯
