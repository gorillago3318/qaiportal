import { BankFormConfig } from './types'

const MY_BANKS = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'OCBC Bank', 'UOB Malaysia', 'Standard Chartered', 'HSBC Bank Malaysia',
  'Alliance Bank', 'Affin Bank', 'Bank Islam', 'Bank Muamalat', 'BSN',
  'MBSB Bank', 'Citibank Malaysia',
].map(b => ({ label: b, value: b }))

/**
 * Hong Leong Bank — minimal v1 application form.
 * Main applicant & co-borrower are collected in Steps 2 & 3 of the wizard.
 * Bank-specific sections start from Step 5.
 */
export const hlbConfig: BankFormConfig = {
  bankId: 'hong_leong_bank',
  bankName: 'Hong Leong Bank',
  // All loan-detail fields are captured in the hardcoded Step 4 of the wizard.
  // Bank-specific sections are empty for v1; add bank-unique fields here in future.
  sections: [],
}
