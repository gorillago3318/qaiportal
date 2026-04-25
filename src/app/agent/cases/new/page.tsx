'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, CheckCircle, Loader2, Plus, X, Save, FileText, Send, Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getBankFormConfig, getSupportedBanks, BankFormConfig } from '@/config/bank-forms'
import { projectClientToBankForm, type ClientProfile } from '@/lib/client-profile-mapping'
import { DynamicBankForm, getTotalSections } from '@/components/dynamic-bank-form'
import { CasePrintView } from '@/components/case-print-view'
import { CoBorrowerManager } from '@/components/co-borrower-manager'

// ─── Helper Functions ──────────────────────────────────────────

const formatDateToDDMMYYYY = (dateString: string | null): string => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString // Return as-is if invalid
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateString
  }
}

const formatDateToYYYYMMDD = (dateString: string): string => {
  // Convert DD/MM/YYYY to YYYY-MM-DD for HTML date input
  if (!dateString || !dateString.includes('/')) return dateString
  const [day, month, year] = dateString.split('/')
  return `${year}-${month}-${day}`
}

const formatDateForDisplay = (dateString: string): string => {
  // Convert YYYY-MM-DD from input to DD/MM/YYYY for display
  if (!dateString || dateString.length !== 10) return dateString
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

// Extract DOB from Malaysian NRIC (format: YYMMDD-XX-XXXX)
const extractDOBFromNRIC = (nric: string): string | null => {
  if (!nric || nric.length < 6) return null
  
  // Remove dashes and spaces
  const cleanNRIC = nric.replace(/[-\s]/g, '')
  
  // First 6 digits should be YYMMDD
  if (cleanNRIC.length < 6) return null
  
  const yearStr = cleanNRIC.substring(0, 2)
  const monthStr = cleanNRIC.substring(2, 4)
  const dayStr = cleanNRIC.substring(4, 6)
  
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)
  
  // Validate ranges
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  
  // Determine century (if year > current year last 2 digits, assume 1900s)
  const currentYear = new Date().getFullYear() % 100
  const fullYear = year > currentYear ? 1900 + year : 2000 + year
  
  // Format as YYYY-MM-DD for HTML date input
  return `${fullYear}-${monthStr}-${dayStr}`
}

// Input validation helpers
const validateNumericInput = (value: string): string => {
  // Allow only numbers
  return value.replace(/\D/g, '')
}

const validateDecimalInput = (value: string): string => {
  // Allow numbers and one decimal point
  return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
}

// ─── Constants ───────────────────────────────────────────────────
const SUPPORTED_BANKS = getSupportedBanks()
const ALL_MALAYSIAN_BANKS = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank",
  "AmBank", "OCBC Bank", "UOB Malaysia", "Standard Chartered", "HSBC Bank Malaysia",
  "Alliance Bank", "Affin Bank", "Bank Islam", "Bank Muamalat", "BSN",
  "MBSB Bank", "Citibank Malaysia",
]

// ─── Types ───────────────────────────────────────────────────────

interface ValuerInfo {
  firm: string
  name: string
  contact_number: string
  email: string
  valuation_date: string
  indicative_value: string
  valuation_fee_quoted: string
  report_received: boolean
}

interface LawyerInfo {
  has_lawyer: boolean
  is_panel_lawyer: boolean
  lawyer_name: string
  law_firm_name: string
  contact_number: string
  email: string
  address: string
}

export interface CoBorrowerInfo {
  title: string
  full_name: string
  ic_passport: string
  old_ic: string
  passport_expiry: string
  date_of_birth: string
  gender: string
  race: string
  bumiputra: string
  marital_status: string
  relationship: string
  no_of_dependants: string
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

interface OtherFinancingFacility {
  bank_name: string
  facility_type: string
  facility_amount: string
  outstanding_amount: string
  payment_amount: string
  security_type: string
  security_value: string
}

interface CaseFormData {
  loan_type: string
  selected_bank: string
  proposed_bank_db_id: string
  client_title: string
  client_name: string
  id_type: string
  client_ic: string
  client_old_ic: string
  client_passport: string
  client_other_id: string
  passport_expiry_date: string
  client_dob: string
  gender: string
  race: string
  bumiputra: string
  marital_status: string
  no_of_dependants: string
  residency_status: string
  home_address: string
  post_code: string
  city: string
  state: string
  country: string
  years_at_address: string
  correspondence_same_as_home: boolean
  correspondence_address: string
  client_email: string
  client_phone: string
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
  product_type: string
  is_islamic: boolean
  purpose_of_financing: string[]
  facility_type: string
  facility_amount: string
  facility_tenure_months: string
  overdraft_amount: string
  overdraft_tenure_months: string
  other_facility_details: string
  finance_legal_cost: boolean
  legal_cost_amount: string
  finance_valuation_cost: boolean
  valuation_cost_amount: string
  current_bank_name: string
  refinance_purpose: string[]
  insurance_type: string
  insurance_financed_by: string
  insurance_premium_amount: string
  insurance_term_months: string
  deferment_period_months: string
  sum_insured_main: string
  sum_insured_joint: string
  sum_insured_3rd: string
  sum_insured_4th: string
  loan_amount: string
  loan_tenure: string
  interest_rate: string
  loan_purpose: string
  property_type: string
  property_subtype: string
  no_of_storey: string
  financing_type: string
  built_type: string
  construction_stage: string
  percent_completed: string
  project_name: string
  developer_seller_name: string
  property_address: string
  property_post_code: string
  property_city: string
  property_state: string
  property_country: string
  purchase_price: string
  first_house: string
  land_size_sqft: string
  buildup_size_sqft: string
  age_of_building: string
  construction_cost: string
  spa_date: string
  leasehold_expiry_date: string
  property_value: string
  title_type: string
  title_no: string
  title_lot_no: string
  mukim: string
  district: string
  land_tenure: string
  title_restriction: string
  title_restriction_details: string
  land_use: string
  other_financing_facilities: OtherFinancingFacility[]
  co_borrowers: CoBorrowerInfo[]
  valuer_info: ValuerInfo | null
  lawyer_info: LawyerInfo | null
  notes: string
  // ── Step 4: Loan Details ──────────────────────────────────────────────────
  purchase_price_market_value: string  // property value / purchase price
  home_loan_amount: string             // base loan before financed fees
  home_loan_tenure: string             // tenure in years
  cashout_amount: string               // cash-out (refinance only)
  // Financed fees
  // (finance_legal_cost & legal_cost_amount already exist above)
  // (finance_valuation_cost & valuation_cost_amount already exist above)
  // ── Step 4: Current Loan (refinance only) ────────────────────────────────
  // (current_bank_name already exists above)
  existing_outstanding: string         // current outstanding balance
  existing_monthly: string             // current monthly instalment
  existing_interest_rate: string       // current interest rate %
  existing_tenure_years: string        // remaining tenure years
  // ── Step 5: Lawyer Selection ─────────────────────────────────────────────
  selected_lawyer_type: 'panel' | 'others' | ''
  lawyer_id: string
  lawyer_professional_fee: string
  has_special_arrangement: boolean
  special_arrangement_discount: string
  lawyer_name_other: string
  lawyer_firm_other: string
  lawyer_contact_other: string
  lawyer_email_other: string
}

const initialForm: CaseFormData = {
  loan_type: '',
  selected_bank: '',
  proposed_bank_db_id: '',
  client_title: '',
  client_name: '',
  id_type: 'nric',
  client_ic: '',
  client_old_ic: '',
  client_passport: '',
  client_other_id: '',
  passport_expiry_date: '',
  client_dob: '',
  gender: '',
  race: '',
  bumiputra: '',
  marital_status: '',
  no_of_dependants: '',
  residency_status: '',
  home_address: '',
  post_code: '',
  city: '',
  state: '',
  country: '',
  years_at_address: '',
  correspondence_same_as_home: true,
  correspondence_address: '',
  client_email: '',
  client_phone: '',
  employment_type: '',
  employer_name: '',
  nature_of_business: '',
  occupation: '',
  employer_address: '',
  office_tel: '',
  length_service_years: '',
  length_service_months: '',
  monthly_income: '',
  company_establishment_date: '',
  prev_employer_name: '',
  prev_nature_of_business: '',
  prev_occupation: '',
  prev_length_service: '',
  product_type: '',
  is_islamic: false,
  purpose_of_financing: [],
  facility_type: 'term_loan',
  facility_amount: '',
  facility_tenure_months: '',
  overdraft_amount: '',
  overdraft_tenure_months: '',
  other_facility_details: '',
  finance_legal_cost: false,
  legal_cost_amount: '',
  finance_valuation_cost: false,
  valuation_cost_amount: '',
  current_bank_name: '',
  refinance_purpose: [],
  insurance_type: 'none',
  insurance_financed_by: '',
  insurance_premium_amount: '',
  insurance_term_months: '',
  deferment_period_months: '',
  sum_insured_main: '',
  sum_insured_joint: '',
  sum_insured_3rd: '',
  sum_insured_4th: '',
  loan_amount: '',
  loan_tenure: '',
  interest_rate: '',
  loan_purpose: 'purchase',
  property_type: 'residential',
  property_subtype: '',
  no_of_storey: '',
  financing_type: 'purchase_developer',
  built_type: 'intermediate',
  construction_stage: 'completed',
  percent_completed: '',
  project_name: '',
  developer_seller_name: '',
  property_address: '',
  property_post_code: '',
  property_city: '',
  property_state: '',
  property_country: 'Malaysia',
  purchase_price: '',
  first_house: '',
  land_size_sqft: '',
  buildup_size_sqft: '',
  age_of_building: '',
  construction_cost: '',
  spa_date: '',
  leasehold_expiry_date: '',
  property_value: '',
  title_type: 'individual',
  title_no: '',
  title_lot_no: '',
  mukim: '',
  district: '',
  land_tenure: 'freehold',
  title_restriction: 'no_restriction',
  title_restriction_details: '',
  land_use: 'residential',
  other_financing_facilities: [],
  co_borrowers: [],
  valuer_info: null,
  lawyer_info: null,
  notes: '',
  // Step 4 — Loan Details
  purchase_price_market_value: '',
  home_loan_amount: '',
  home_loan_tenure: '',
  cashout_amount: '',
  existing_outstanding: '',
  existing_monthly: '',
  existing_interest_rate: '',
  existing_tenure_years: '',
  // Step 5 — Lawyer Selection
  selected_lawyer_type: '',
  lawyer_id: '',
  lawyer_professional_fee: '',
  has_special_arrangement: false,
  special_arrangement_discount: '',
  lawyer_name_other: '',
  lawyer_firm_other: '',
  lawyer_contact_other: '',
  lawyer_email_other: ''
}

const formatTenureFromMonths = (months: number | null): string => {
  if (!months) return ''
  const years = Math.floor(months / 12)
  return years.toString()
}

function NewCasePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const calculationId = searchParams.get('from_calculation')
  const caseIdParam = searchParams.get('id')

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<CaseFormData>(initialForm)
  const [bankConfig, setBankConfig] = useState<BankFormConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingCalculation, setIsFetchingCalculation] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPrintView, setShowPrintView] = useState(false)
  const [savedCaseData, setSavedCaseData] = useState<any>(null)
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null)
  const [restoredFromCache, setRestoredFromCache] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isSavingRef = useRef(false)
  const [pendingDocs, setPendingDocs] = useState<Array<{ type: string; file: File }>>([])
  // doc categories are defined inside renderFinalReview

  // ── localStorage persistence key ─────────────────────────────
  const LS_KEY = 'qai_new_case_draft'

  // Restore from localStorage on mount
  // Skip when ?id= param is present (loadExistingCase will handle it from DB)
  // Skip when ?from_calculation= is present (fetchCalculationData clears stale cache first)
  useEffect(() => {
    if (caseIdParam || calculationId) return // DB source takes priority; skip stale cache
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      // Expire after 48 hours
      if (Date.now() - (saved.ts || 0) > 48 * 3600 * 1000) {
        localStorage.removeItem(LS_KEY)
        return
      }
      if (saved.formData?.selected_bank) {
        setFormData(saved.formData as CaseFormData)
        if (saved.savedCaseId) setSavedCaseId(saved.savedCaseId)
        if (saved.currentStep) setCurrentStep(saved.currentStep)
        setRestoredFromCache(true)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage whenever form data or step changes (debounced 800ms)
  useEffect(() => {
    if (!formData.selected_bank) return // don't persist an empty form
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          formData,
          savedCaseId,
          currentStep,
          ts: Date.now(),
        }))
      } catch {}
    }, 800)
    return () => clearTimeout(timer)
  }, [formData, savedCaseId, currentStep])

  // Auto-save to DB: 2 s after any formData change, silently in background.
  // ONLY PATCHes an existing draft — never auto-creates a new case.
  // First creation is always triggered explicitly (Save as Draft button or handleNext on step 1).
  useEffect(() => {
    if (!savedCaseId) return  // nothing to patch yet — wait for explicit first save
    if (!formData.loan_type || !formData.selected_bank) return
    const timer = setTimeout(async () => {
      if (isSavingRef.current) return
      isSavingRef.current = true
      setAutoSaveStatus('saving')
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const clientId = await upsertClient(supabase, user.id)
        const payload = { ...buildCasePayload(user.id), client_id: clientId }
        const res = await fetch(`/api/cases/${savedCaseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, client_id: undefined }),
        })
        if (!res.ok) throw new Error()
        const { data: updated } = await res.json()
        setSavedCaseData(updated)
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      } catch {
        setAutoSaveStatus('error')
      } finally {
        isSavingRef.current = false
      }
    }, 2000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, savedCaseId])

  // Lawyer selection state
  const [availableLawyers, setAvailableLawyers] = useState<Array<{
    id: string
    name: string
    firm: string
    general_email: string | null
    phone: string | null
  }>>([])

  // Map from bank config ID (e.g. 'hong_leong_bank') → DB UUID
  const [bankDbIdMap, setBankDbIdMap] = useState<Record<string, string>>({})

  // Load DB bank UUIDs on mount so bank selection can store proposed_bank_id
  useEffect(() => {
    const supabase = createClient()
    supabase.from('banks').select('id, name').eq('is_active', true).then(({ data }) => {
      if (!data) return
      const map: Record<string, string> = {}
      // Normalize: strip non-alphanumeric chars for fuzzy matching (handles e.g. "Hong Leong Bank" vs "Hong Leong Bank (HLBB)")
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
      SUPPORTED_BANKS.forEach(b => {
        const configNorm = normalize(b.name)
        const match = data.find((db: { id: string; name: string }) => {
          const dbNorm = normalize(db.name)
          return dbNorm === configNorm || dbNorm.startsWith(configNorm) || configNorm.startsWith(dbNorm)
        })
        if (match) map[b.id] = match.id
      })
      setBankDbIdMap(map)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fixed 6-step wizard — bank configs have empty sections (all fields hardcoded)
  const totalSteps = 6
  const STEP_LABELS = ['Bank & Loan Type', 'Client Info', 'Co-Borrower', 'Loan Details', 'Lawyer', 'Documents & Submit']

  useEffect(() => {
    if (formData.selected_bank) {
      const config = getBankFormConfig(formData.selected_bank)
      setBankConfig(config || null)
    } else {
      setBankConfig(null)
    }
  }, [formData.selected_bank])

  // Auto-fill bank form lawyer fields from Step 4 selection so agent isn't asked twice
  useEffect(() => {
    if (formData.selected_lawyer_type === 'panel' && formData.lawyer_id) {
      const lawyer = availableLawyers.find(l => l.id === formData.lawyer_id)
      if (lawyer) {
        setFormData(prev => ({
          ...prev,
          has_lawyer: 'yes',
          lawyer_name: lawyer.name,
          lawyer_firm: lawyer.firm,
          lawyer_contact: lawyer.phone || '',
          lawyer_email: lawyer.general_email || '',
        } as any))
      }
    } else if (formData.selected_lawyer_type === 'others' && formData.lawyer_name_other) {
      setFormData(prev => ({
        ...prev,
        has_lawyer: 'yes',
        lawyer_name: formData.lawyer_name_other,
        lawyer_firm: formData.lawyer_firm_other,
        lawyer_contact: formData.lawyer_contact_other,
        lawyer_email: formData.lawyer_email_other,
      } as any))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.lawyer_id, formData.selected_lawyer_type, formData.lawyer_name_other])

  // Fetch panel lawyers when bank changes
  useEffect(() => {
    const fetchPanelLawyers = async () => {
      const dbBankId = formData.proposed_bank_db_id
      if (!dbBankId) {
        setAvailableLawyers([])
        return
      }
      try {
        const supabase = createClient()
        const { data: associations } = await supabase
          .from('lawyer_bank_associations')
          .select('lawyer_id')
          .eq('bank_id', dbBankId)
          .eq('is_panel', true)

        if (!associations || associations.length === 0) {
          setAvailableLawyers([])
          return
        }

        const lawyerIds = associations.map((a: { lawyer_id: string }) => a.lawyer_id)
        const { data: lawyers, error } = await supabase
          .from('lawyers')
          .select('id, name, firm, general_email, phone')
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
  }, [formData.proposed_bank_db_id])

  useEffect(() => {
    if (calculationId) {
      fetchCalculationData(calculationId)
    }
  }, [calculationId])

  // Load existing draft when ?id= param is present (e.g. after save, or via Edit Case link)
  useEffect(() => {
    if (caseIdParam && !savedCaseId) {
      loadExistingCase(caseIdParam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIdParam])

  const loadExistingCase = async (id: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: caseData, error } = await supabase
        .from('cases')
        .select('*, proposed_bank:banks(id, name)')
        .eq('id', id)
        .single()
      if (error || !caseData) {
        // Case doesn't exist (e.g. DB was wiped) — clear stale localStorage so we don't
        // show old data on next navigation
        try { localStorage.removeItem(LS_KEY) } catch {}
        setSavedCaseId(null)
        setSavedCaseData(null)
        return
      }

      const c = caseData as any
      const bankData: Record<string, any> = c.bank_form_data || {}

      // Resolve bank config ID
      let selectedBank: string = bankData.selected_bank || ''
      let proposedBankDbId: string = c.proposed_bank_id || ''
      if (!selectedBank && c.proposed_bank?.name) {
        const match = SUPPORTED_BANKS.find(
          (b: { id: string; name: string }) =>
            b.name.toLowerCase() === c.proposed_bank.name.toLowerCase()
        )
        selectedBank = match?.id || ''
      }
      if (!proposedBankDbId && c.proposed_bank?.id) {
        proposedBankDbId = c.proposed_bank.id
      }

      setFormData({
        ...initialForm,
        ...bankData,
        loan_type: c.loan_type || bankData.loan_type || '',
        selected_bank: selectedBank,
        proposed_bank_db_id: proposedBankDbId,
        co_borrowers: bankData.co_borrowers || [],
        other_financing_facilities: bankData.other_financing_facilities || [],
      } as CaseFormData)
      setSavedCaseId(id)
      setSavedCaseData(c)
      // Update localStorage so Back-button navigation also has fresh data
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          formData: {
            ...initialForm,
            ...bankData,
            loan_type: c.loan_type || bankData.loan_type || '',
            selected_bank: selectedBank,
            proposed_bank_db_id: proposedBankDbId,
            co_borrowers: bankData.co_borrowers || [],
            other_financing_facilities: bankData.other_financing_facilities || [],
          },
          savedCaseId: id,
          currentStep: 1,
          ts: Date.now(),
        }))
      } catch {}
    } catch (e) {
      console.error('Failed to load case:', e)
      toast.error('Failed to load draft. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCalculationData = async (calcId: string) => {
    setIsFetchingCalculation(true)
    try {
      const supabase = createClient()
      const { data: calculation, error } = await supabase
        .from('calculations')
        .select('*, case_id, proposed_bank:banks(id, name)')
        .eq('id', calcId)
        .single()

      if (error) throw error
      if (!calculation) return

      const calc = calculation as any

      // If this calculation already has a linked draft case, resume it instead of starting fresh
      if (calc.case_id) {
        setIsFetchingCalculation(false)
        await loadExistingCase(calc.case_id)
        return
      }

      // Fresh calculation — purge any stale localStorage so old form data / deleted case IDs
      // don't bleed into this new case form
      try { localStorage.removeItem(LS_KEY) } catch {}
      setSavedCaseId(null)
      setSavedCaseData(null)
      setRestoredFromCache(false)

      // Resolve bank config ID from DB bank name (e.g. "OCBC Bank" → "ocbc_bank")
      const calcBankName: string = calc.proposed_bank?.name || ''
      const matchedBank = SUPPORTED_BANKS.find(b => b.name.toLowerCase() === calcBankName.toLowerCase())
      const calcBankConfigId = matchedBank?.id || ''
      const calcBankDbId = calc.proposed_bank?.id || ''

      const mappedData: CaseFormData = {
        ...initialForm,
        loan_type: calc.loan_type || '',
        selected_bank: calcBankConfigId,
        proposed_bank_db_id: calcBankDbId,
        client_title: calc.client_title || 'mr',
        client_name: calc.client_name || '',
        client_ic: calc.client_ic || '',
        client_old_ic: calc.client_old_ic || '',
        client_passport: calc.client_passport || '',
        id_type: calc.id_type || 'nric',
        passport_expiry_date: calc.passport_expiry_date || '',
        client_dob: calc.client_dob || '',
        gender: calc.gender || '',
        race: calc.race || '',
        bumiputra: calc.bumiputra || '',
        marital_status: calc.marital_status || '',
        no_of_dependants: calc.no_of_dependants || '',
        home_address: calc.home_address || '',
        post_code: calc.post_code || '',
        city: calc.city || '',
        state: calc.state || '',
        country: calc.country || 'MALAYSIA',
        years_at_address: calc.years_at_address || '',
        client_phone: calc.client_phone || calc.contact_number || '',
        client_email: calc.client_email || '',
        employment_type: calc.employment_type || '',
        employer_name: calc.client_employer || calc.employer_name || '',
        nature_of_business: calc.nature_of_business || '',
        occupation: calc.occupation || '',
        employer_address: calc.office_address || calc.employer_address || '',
        office_tel: calc.office_tel || '',
        length_service_years: calc.length_service_years || '',
        length_service_months: calc.length_service_months || '',
        monthly_income: calc.client_monthly_income || calc.monthly_income || '',
        product_type: calc.product_type || 'term_loan',
        loan_purpose: calc.has_cash_out ? 'cash_out_refinance' : (calc.loan_purpose || 'purchase'),
        facility_amount: calc.proposed_loan_amount?.toString() || calc.loan_amount?.toString() || '',
        facility_tenure_months: calc.proposed_tenure_months?.toString()
          || (calc.tenure_years ? (parseInt(calc.tenure_years) * 12).toString() : ''),
        loan_tenure: calc.tenure_years || formatTenureFromMonths(calc.proposed_tenure_months) || '',
        interest_rate: calc.proposed_interest_rate?.toString() || calc.interest_rate?.toString() || '',
        property_address: calc.property_address || '',
        property_post_code: calc.property_postcode || '',
        property_type: calc.property_type || '',
        buildup_size_sqft: calc.buildup_area || calc.property_size_buildup?.toString() || '',
        land_size_sqft: calc.land_area || calc.property_size_land?.toString() || '',
        purchase_price: calc.purchase_price || calc.property_value?.toString() || '',
        title_type: calc.title_type || '',
        land_tenure: calc.land_type || calc.property_tenure || '',
        notes: calc.finance_legal_fees ? 'Legal fees financed by bank' : ''
      }

      setFormData(mappedData)
    } catch (error) {
      console.error('Error fetching calculation:', error)
    } finally {
      setIsFetchingCalculation(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Auto-extract DOB from NRIC
      if (field === 'client_ic' && prev.id_type === 'nric') {
        const dob = extractDOBFromNRIC(value)
        if (dob) {
          newData.client_dob = dob
        }
      }
      
      return newData
    })
    
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleDynamicFormChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  // ── Cross-bank client autofill ────────────────────────────────
  // When the agent enters a client_ic (or pastes one), look up the clients
  // table. If a matching profile exists (from a previous case), project it
  // into the current bank-form keys. Only empties are filled — never clobbers
  // what the agent has already typed.
  const lookedUpIcRef = useRef<string>('')
  useEffect(() => {
    const ic = (formData.client_ic || '').trim()
    if (!ic || ic.length < 6) return
    if (ic === lookedUpIcRef.current) return
    const bankId = bankConfig?.bankId
    if (!bankId) return
    lookedUpIcRef.current = ic

    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients/lookup?ic=${encodeURIComponent(ic)}`, { signal: controller.signal })
        if (!res.ok) return
        const { data } = await res.json() as { data: ClientProfile | null }
        if (!data) return
        setFormData(prev => {
          const patch = projectClientToBankForm(data, bankId, prev as unknown as Record<string, unknown>)
          if (Object.keys(patch).length === 0) return prev
          toast.success(`Autofilled ${Object.keys(patch).length} field(s) from previous case for this IC`)
          return { ...prev, ...patch } as CaseFormData
        })
      } catch {
        // silent
      }
    }, 450)

    return () => { clearTimeout(t); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.client_ic, bankConfig?.bankId])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.loan_type) {
        newErrors.loan_type = 'Please select a loan type'
      }
      if (!formData.selected_bank) {
        newErrors.selected_bank = 'Please select a bank'
      }
    }

    if (step === 2) {
      if (!formData.client_name.trim()) {
        newErrors.client_name = 'Client name is required'
      }
      
      if (formData.id_type === 'nric' && !formData.client_ic.trim()) {
        newErrors.client_ic = 'NRIC number is required'
      } else if (formData.id_type === 'passport') {
        if (!formData.client_passport.trim()) {
          newErrors.client_passport = 'Passport number is required'
        }
        if (!formData.passport_expiry_date) {
          newErrors.passport_expiry_date = 'Passport expiry date is required'
        }
      } else if (formData.id_type === 'others' && !formData.client_other_id.trim()) {
        newErrors.client_other_id = 'ID number is required'
      }
      
      if (!formData.client_dob) {
        newErrors.client_dob = 'Date of birth is required'
      }
      if (!formData.client_phone.trim()) {
        newErrors.client_phone = 'Phone number is required'
      }
    }

    // Step 4 — Loan Details
    if (step === 4) {
      if (!formData.purchase_price_market_value || parseFloat(formData.purchase_price_market_value) <= 0)
        newErrors.purchase_price_market_value = 'Property value / purchase price is required'
      if (!formData.home_loan_amount || parseFloat(formData.home_loan_amount) <= 0)
        newErrors.home_loan_amount = 'Loan amount is required'
      if (!formData.home_loan_tenure || parseFloat(formData.home_loan_tenure) <= 0)
        newErrors.home_loan_tenure = 'Loan tenure is required'
      if (formData.finance_legal_cost && (!formData.legal_cost_amount || parseFloat(formData.legal_cost_amount) <= 0))
        newErrors.legal_cost_amount = 'Legal fee amount is required when financing legal fees'
      if (formData.finance_valuation_cost && (!formData.valuation_cost_amount || parseFloat(formData.valuation_cost_amount) <= 0))
        newErrors.valuation_cost_amount = 'Valuation fee amount is required when financing valuation fees'
      if (formData.loan_type === 'refinance' && !formData.current_bank_name)
        newErrors.current_bank_name = 'Current financier is required for refinance'
    }

    // Step 5 — Lawyer Selection
    if (step === 5) {
      if (!formData.selected_lawyer_type)
        newErrors.selected_lawyer_type = 'Please select lawyer type'
      if (formData.selected_lawyer_type === 'panel') {
        if (!formData.lawyer_id)
          newErrors.lawyer_id = 'Please select a panel lawyer'
        if (!formData.lawyer_professional_fee || parseFloat(formData.lawyer_professional_fee) <= 0)
          newErrors.lawyer_professional_fee = 'Professional fee is required and must be greater than 0'
        if (formData.has_special_arrangement && (!formData.special_arrangement_discount || parseFloat(formData.special_arrangement_discount) <= 0))
          newErrors.special_arrangement_discount = 'Discount amount is required when special arrangement is checked'
      } else if (formData.selected_lawyer_type === 'others') {
        if (!formData.lawyer_name_other.trim())
          newErrors.lawyer_name_other = 'Lawyer name is required'
        if (!formData.lawyer_firm_other.trim())
          newErrors.lawyer_firm_other = 'Law firm is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps))
      // Auto-create the draft on leaving step 1 (bank + loan type selected)
      // so subsequent keystrokes on later steps are auto-saved via PATCH
      if (currentStep === 1 && !savedCaseId) {
        // Fire-and-forget silent save — no toast, no blocking UI
        ;(async () => {
          if (isSavingRef.current) return
          isSavingRef.current = true
          setAutoSaveStatus('saving')
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const payload = buildCasePayload(user.id)
            const res = await fetch('/api/cases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, status: 'draft' }),
            })
            if (!res.ok) return
            const { data } = await res.json()
            const newId = data?.id
            if (!newId) return
            setSavedCaseId(newId)
            setSavedCaseData(data)
            router.replace(`/agent/cases/new?id=${newId}`)
            if (calculationId) {
              await supabase.from('calculations').update({ converted_to_case_id: newId }).eq('id', calculationId)
            }
            setAutoSaveStatus('saved')
            setTimeout(() => setAutoSaveStatus('idle'), 3000)
          } catch {
            setAutoSaveStatus('error')
          } finally {
            isSavingRef.current = false
          }
        })()
      }
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // Build the case payload from current formData (shared by draft + submit)
  const buildCasePayload = (agentId: string) => {
    // ── Compute proposed loan amount ─────────────────────────────────────────
    // Base loan + optionally-financed legal fee + optionally-financed valuation fee + cash-out
    const baseAmt    = parseFloat(formData.home_loan_amount) || 0
    const legalAmt   = formData.finance_legal_cost   ? (parseFloat(formData.legal_cost_amount)    || 0) : 0
    const valuerAmt  = formData.finance_valuation_cost? (parseFloat(formData.valuation_cost_amount) || 0) : 0
    const cashoutAmt = parseFloat(formData.cashout_amount) || 0
    const totalLoan  = Math.round((baseAmt + legalAmt + valuerAmt + cashoutAmt) * 100) / 100

    return ({
      agent_id: agentId,
      loan_type: formData.loan_type || 'refinance',
      proposed_bank_id: formData.proposed_bank_db_id || null,
      proposed_loan_amount: totalLoan || null,
      legal_fee_amount: legalAmt || null,
      valuation_fee_amount: valuerAmt || null,
      finance_legal_fees: legalAmt > 0 || valuerAmt > 0,
      has_cash_out: cashoutAmt > 0,
      cash_out_amount: cashoutAmt || null,
      // Map current-loan fields to DB columns
      current_bank: formData.current_bank_name || null,
      current_loan_amount: parseFloat(formData.existing_outstanding) || null,
      current_monthly_instalment: parseFloat(formData.existing_monthly) || null,
      current_interest_rate: parseFloat(formData.existing_interest_rate) || null,
      current_tenure_months: formData.existing_tenure_years ? (parseFloat(formData.existing_tenure_years) * 12) : null,
      property_value: parseFloat(formData.purchase_price_market_value) || null,
      // Lawyer — written to top-level FK columns so admin can join/query directly
      lawyer_id: formData.selected_lawyer_type === 'panel' ? (formData.lawyer_id || null) : null,
      lawyer_name_other: formData.selected_lawyer_type === 'others' ? (formData.lawyer_name_other || null) : null,
      lawyer_firm_other: formData.selected_lawyer_type === 'others' ? (formData.lawyer_firm_other || null) : null,
      lawyer_professional_fee: formData.selected_lawyer_type === 'panel' && formData.lawyer_professional_fee
        ? parseFloat(formData.lawyer_professional_fee) : null,
      status: 'draft',
      bank_form_data: {
        // Spread ALL formData so every field is preserved in JSONB
        ...formData,
        // Numeric overrides
        no_of_dependants: parseInt(formData.no_of_dependants) || 0,
        length_service_years: parseInt(formData.length_service_years) || 0,
        length_service_months: parseInt(formData.length_service_months) || 0,
        monthly_income: parseFloat(formData.monthly_income) || 0,
        lawyer_id: formData.lawyer_id || null,
        lawyer_professional_fee: formData.lawyer_professional_fee
          ? parseFloat(formData.lawyer_professional_fee)
          : null,
        special_arrangement_discount: formData.special_arrangement_discount
          ? parseFloat(formData.special_arrangement_discount)
          : null,
        // Computed total for display/PDF
        total_financing_amount: totalLoan || null,
      }
    })
  }

  // Upsert client record from form data. Returns client id or null if insufficient data.
  const upsertClient = async (supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> => {
    const icNumber = formData.client_ic || formData.client_passport || formData.client_other_id
    if (!icNumber || !formData.client_name) return null
    try {
      // Check if client already exists by IC
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('ic_number', icNumber)
        .maybeSingle()
      if (existing) return existing.id

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          full_name: formData.client_name,
          ic_number: icNumber,
          phone: formData.client_phone || '',
          email: formData.client_email || null,
          date_of_birth: formData.client_dob || null,
          gender: formData.gender || null,
          marital_status: formData.marital_status || null,
          address: formData.home_address || null,
          employer: formData.employer_name || null,
          monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
          created_by: userId,
        })
        .select('id')
        .single()
      if (error) throw error
      return newClient?.id ?? null
    } catch {
      return null
    }
  }

  const handleSaveDraft = async () => {
    if (!formData.loan_type) {
      toast.error('Please select a loan type before saving as draft.')
      return
    }
    if (!formData.selected_bank) {
      toast.error('Please select a bank before saving as draft.')
      return
    }
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const clientId = await upsertClient(supabase, user.id)
      const payload = { ...buildCasePayload(user.id), client_id: clientId }

      if (savedCaseId) {
        // Already saved — PATCH the existing draft
        const res = await fetch(`/api/cases/${savedCaseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, client_id: undefined }),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error || 'Failed to update draft')
        }
        const { data: updated } = await res.json()
        setSavedCaseData(updated)
        toast.success('Draft updated!')
      } else {
        // First save — fetch agency_id then INSERT via API (avoids RLS issues)
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'draft' }),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error || 'Failed to save draft')
        }
        const { data } = await res.json()
        const newId = data?.id
        if (!newId) throw new Error('No case ID returned')
        setSavedCaseId(newId)
        setSavedCaseData(data)
        // Update URL so refreshing/Back keeps this draft
        router.replace(`/agent/cases/new?id=${newId}`)
        if (calculationId) {
          await supabase.from('calculations').update({ converted_to_case_id: newId }).eq('id', calculationId)
        }
        toast.success('Draft saved! Fill in remaining details, then Render to PDF and Submit.')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save draft. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    // Validate all steps
    let firstErrorStep = 0
    for (let step = 1; step <= totalSteps; step++) {
      if (!validateStep(step)) {
        if (!firstErrorStep) firstErrorStep = step
      }
    }

    if (firstErrorStep) {
      setCurrentStep(firstErrorStep)
      toast.error('Please fill in all required fields. Jumped to the first step with errors.')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const clientId = await upsertClient(supabase, user.id)

      // Upload any pending documents to Supabase Storage
      const caseIdForUpload = savedCaseId || 'new'
      const uploadedDocs: Array<{ document_type: string; file_name: string; file_url: string; file_size: number }> = []
      for (const { type, file } of pendingDocs) {
        const ext = file.name.split('.').pop()
        const path = `${caseIdForUpload}/${type.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('case-documents').upload(path, file)
        if (upErr) throw new Error(`Upload failed for ${type}: ${upErr.message}`)
        const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(path)
        uploadedDocs.push({ document_type: type, file_name: file.name, file_url: urlData.publicUrl, file_size: file.size })
      }

      if (savedCaseId) {
        // Case already saved — PATCH status to submitted
        const res = await fetch(`/api/cases/${savedCaseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildCasePayload(user.id), status: 'submitted', notes: 'Case submitted by agent.', new_documents: uploadedDocs }),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error || 'Failed to submit case')
        }
      } else {
        // Not saved yet — INSERT via API (ensures agency_id is set, avoids RLS)
        const payload = { ...buildCasePayload(user.id), client_id: clientId, status: 'submitted', new_documents: uploadedDocs }
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error || 'Failed to submit case')
        }
        const { data } = await res.json()
        if (calculationId && data?.id) {
          await supabase.from('calculations').update({ converted_to_case_id: data.id }).eq('id', calculationId)
        }
      }

      localStorage.removeItem(LS_KEY)
      toast.success('Case submitted successfully!')
      router.push('/agent/cases')
    } catch (error: any) {
      console.error('Error submitting case:', error)
      toast.error(error?.message || 'Failed to submit case. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Step 4: Loan Details ────────────────────────────────────────────────
  const renderStep4_LoanDetails = () => {
    const isRefinance = formData.loan_type === 'refinance'
    const base    = parseFloat(formData.home_loan_amount)    || 0
    const legal   = formData.finance_legal_cost    ? (parseFloat(formData.legal_cost_amount)    || 0) : 0
    const valuer  = formData.finance_valuation_cost ? (parseFloat(formData.valuation_cost_amount) || 0) : 0
    const cashout = isRefinance ? (parseFloat(formData.cashout_amount) || 0) : 0
    const total   = base + legal + valuer + cashout

    const MY_BANKS_LIST = [
      'Maybank','CIMB Bank','Public Bank','RHB Bank','Hong Leong Bank',
      'AmBank','OCBC Bank','UOB Malaysia','Standard Chartered','HSBC Bank Malaysia',
      'Alliance Bank','Affin Bank','Bank Islam','Bank Muamalat','BSN','MBSB Bank','Citibank Malaysia',
    ]

    const numInput = (field: keyof CaseFormData, label: string, required = false, prefix?: string) => (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
        <div className="relative">
          {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">{prefix}</span>}
          <input
            type="number"
            min="0"
            step="0.01"
            value={(formData as any)[field] ?? ''}
            onChange={e => handleInputChange(field, e.target.value)}
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500',
              prefix ? 'pl-10' : '',
              (errors as any)[field] ? 'border-red-500' : 'border-gray-300'
            )}
          />
        </div>
        {(errors as any)[field] && <p className="text-red-500 text-xs mt-1">{(errors as any)[field]}</p>}
      </div>
    )

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Loan Details</h2>
          <p className="text-gray-600 mt-1">Property value, loan amount, fees, and total financing</p>
        </div>

        {/* ── Property ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Property</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numInput('purchase_price_market_value', 'Purchase Price / Market Value (RM)', true, 'RM')}
            </div>
          </CardContent>
        </Card>

        {/* ── New Loan ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">New Loan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numInput('home_loan_amount', 'Base Loan Amount (RM)', true, 'RM')}
              {numInput('home_loan_tenure', 'Loan Tenure (Years)', true)}
            </div>

            {/* Cash-out for refinance */}
            {isRefinance && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="hasCashout"
                    checked={!!formData.cashout_amount && parseFloat(formData.cashout_amount) > 0}
                    onChange={e => { if (!e.target.checked) handleInputChange('cashout_amount', '') }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasCashout" className="text-sm font-medium text-gray-700">Include Cash-Out Component</label>
                </div>
                {numInput('cashout_amount', 'Cash-Out Amount (RM)', false, 'RM')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Financed Fees ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Finance Fees into Loan?</h3>
            <p className="text-sm text-gray-500 -mt-2">If yes, these amounts are added to the total loan and earn bank commission.</p>

            {/* Legal */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="financeLegal"
                  checked={formData.finance_legal_cost}
                  onChange={e => {
                    handleInputChange('finance_legal_cost', e.target.checked)
                    if (!e.target.checked) handleInputChange('legal_cost_amount', '')
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="financeLegal" className="text-sm font-medium text-gray-700">Finance Legal Fees</label>
              </div>
              {formData.finance_legal_cost && (
                <div className="ml-6">
                  {numInput('legal_cost_amount', 'Legal Fee Amount (RM)', true, 'RM')}
                </div>
              )}
            </div>

            {/* Valuation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="financeValuation"
                  checked={formData.finance_valuation_cost}
                  onChange={e => {
                    handleInputChange('finance_valuation_cost', e.target.checked)
                    if (!e.target.checked) handleInputChange('valuation_cost_amount', '')
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="financeValuation" className="text-sm font-medium text-gray-700">Finance Valuation Fees</label>
              </div>
              {formData.finance_valuation_cost && (
                <div className="ml-6">
                  {numInput('valuation_cost_amount', 'Valuation Fee Amount (RM)', true, 'RM')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Total ── */}
        <div className={cn(
          'rounded-xl p-5 border-2',
          total > 0 ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Loan Amount</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {base > 0 ? `RM ${base.toLocaleString()} base` : ''}
                {legal  > 0 ? ` + RM ${legal.toLocaleString()} legal` : ''}
                {valuer > 0 ? ` + RM ${valuer.toLocaleString()} valuation` : ''}
                {cashout > 0 ? ` + RM ${cashout.toLocaleString()} cash-out` : ''}
              </p>
            </div>
            <p className={cn(
              'text-2xl font-bold',
              total > 0 ? 'text-blue-700' : 'text-gray-400'
            )}>
              {total > 0 ? `RM ${total.toLocaleString()}` : '—'}
            </p>
          </div>
          {total > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              💡 Bank commission is calculated on this total amount. Lawyer commission is based on professional fee (entered in the next step).
            </p>
          )}
        </div>

        {/* ── Current Loan (refinance only) ── */}
        {isRefinance && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-base font-semibold text-gray-800">Current Loan</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Financier <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.current_bank_name}
                  onChange={e => handleInputChange('current_bank_name', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500',
                    errors.current_bank_name ? 'border-red-500' : 'border-gray-300'
                  )}
                >
                  <option value="">Select current bank…</option>
                  {MY_BANKS_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {errors.current_bank_name && <p className="text-red-500 text-xs mt-1">{errors.current_bank_name}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {numInput('existing_outstanding',  'Outstanding Balance (RM)',   false, 'RM')}
                {numInput('existing_monthly',      'Monthly Instalment (RM)',    false, 'RM')}
                {numInput('existing_interest_rate','Current Interest Rate (%)', false)}
                {numInput('existing_tenure_years', 'Remaining Tenure (Years)',  false)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ─── Step 5: Lawyer Selection (commission source 2) ─────────────────────
  const renderStep5_LawyerSelection = () => {
    return renderStep4_LawyerSelection()
  }

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
                value={formData.lawyer_professional_fee ?? ''}
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

  const renderCurrentStep = () => {
    if (showPrintView) {
      // Build print data from in-memory formData (always up-to-date) plus case metadata
      const printData = {
        id: savedCaseId,
        case_code: (savedCaseData as any)?.case_code,
        status: (savedCaseData as any)?.status || 'draft',
        // Spread all form fields directly so CasePrintView can access them at the top level
        ...formData,
      }
      return (
        <CasePrintView
          caseData={printData}
          bankId={bankConfig?.bankId}
          onClose={() => {
            setShowPrintView(false)
            router.push('/agent/cases')
          }}
        />
      )
    }

    switch (currentStep) {
      case 1:  return renderStep1_BankSelection()
      case 2:  return renderStep2_ClientInfo()
      case 3:  return renderStep3_CoBorrowers()
      case 4:  return renderStep4_LoanDetails()
      case 5:  return renderStep5_LawyerSelection()
      case 6:  return renderFinalReview()
      default: return null
    }
  }

  const renderStep1_BankSelection = () => {
    const loanTypes = [
      { value: 'refinance', label: 'Refinance', desc: 'Refinance an existing loan' },
      { value: 'subsale', label: 'Subsale', desc: 'Secondary market property purchase' },
      { value: 'developer', label: 'Developer', desc: 'New property from developer' },
    ]
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Loan Type & Bank</h2>
          <p className="text-gray-600 mt-1">Select the loan type and target bank</p>
        </div>

        {/* Loan Type */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Loan Type *</h3>
            <div className="grid grid-cols-3 gap-3">
              {loanTypes.map(lt => (
                <button
                  key={lt.value}
                  type="button"
                  onClick={() => {
                    handleInputChange('loan_type', lt.value)
                    // Pre-fill purpose_of_financing so bank forms don't ask again
                    const purposeMap: Record<string, string> = {
                      refinance: 'refinance',
                      subsale: 'purchase_own',
                      developer: 'purchase_own',
                    }
                    handleInputChange('purpose_of_financing', purposeMap[lt.value] || '')
                  }}
                  className={cn(
                    "p-4 border-2 rounded-lg text-left transition-all",
                    formData.loan_type === lt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="font-semibold text-sm">{lt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{lt.desc}</div>
                </button>
              ))}
            </div>
            {errors.loan_type && <p className="text-red-500 text-sm mt-2">{errors.loan_type}</p>}
          </CardContent>
        </Card>

        {/* Bank Selection */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Bank *</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SUPPORTED_BANKS.map((bank) => (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      selected_bank: bank.id,
                      proposed_bank_db_id: bankDbIdMap[bank.id] || '',
                    }))
                  }}
                  className={cn(
                    "p-5 border-2 rounded-lg transition-all text-left",
                    formData.selected_bank === bank.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <h3 className="font-semibold">{bank.name}</h3>
                </button>
              ))}
            </div>
            {errors.selected_bank && (
              <p className="text-red-500 text-sm mt-2">{errors.selected_bank}</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderStep2_ClientInfo = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Client Information</h2>
          <p className="text-gray-600 mt-1">Enter the primary borrower's details</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <select
                  value={formData.client_title}
                  onChange={(e) => handleInputChange('client_title', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="mr">Mr</option>
                  <option value="mrs">Mrs</option>
                  <option value="ms">Ms</option>
                  <option value="dr">Dr</option>
                  <option value="prof">Prof</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Enter full name as per IC/Passport"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                    errors.client_name && "border-red-500"
                  )}
                />
                {errors.client_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.client_name}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Type *</label>
              <select
                value={formData.id_type}
                onChange={(e) => handleInputChange('id_type', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="nric">NRIC (Malaysian Identity Card)</option>
                <option value="passport">Passport</option>
                <option value="others">Others</option>
              </select>
            </div>

            {formData.id_type === 'nric' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NRIC Number *</label>
                <input
                  type="text"
                  value={formData.client_ic}
                  onChange={(e) => handleInputChange('client_ic', e.target.value)}
                  placeholder="e.g., 900101-01-1234"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                    errors.client_ic && "border-red-500"
                  )}
                />
                {errors.client_ic && (
                  <p className="text-red-500 text-sm mt-1">{errors.client_ic}</p>
                )}
              </div>
            )}

            {formData.id_type === 'passport' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number *</label>
                  <input
                    type="text"
                    value={formData.client_passport}
                    onChange={(e) => handleInputChange('client_passport', e.target.value)}
                    placeholder="Enter passport number"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                      errors.client_passport && "border-red-500"
                    )}
                  />
                  {errors.client_passport && (
                    <p className="text-red-500 text-sm mt-1">{errors.client_passport}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry Date *</label>
                  <input
                    type="text"
                    value={formatDateForDisplay(formData.passport_expiry_date)}
                    onChange={(e) => {
                      const displayValue = e.target.value
                      const isoDate = formatDateToYYYYMMDD(displayValue)
                      handleInputChange('passport_expiry_date', isoDate)
                    }}
                    placeholder="DD/MM/YYYY"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                      errors.passport_expiry_date && "border-red-500"
                    )}
                  />
                  {errors.passport_expiry_date && (
                    <p className="text-red-500 text-sm mt-1">{errors.passport_expiry_date}</p>
                  )}
                </div>
              </>
            )}

            {formData.id_type === 'others' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Other ID Number *</label>
                <input
                  type="text"
                  value={formData.client_other_id}
                  onChange={(e) => handleInputChange('client_other_id', e.target.value)}
                  placeholder="Enter ID number"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                    errors.client_other_id && "border-red-500"
                  )}
                />
                {errors.client_other_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.client_other_id}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="text"
                  value={formatDateForDisplay(formData.client_dob)}
                  onChange={(e) => {
                    const displayValue = e.target.value
                    const isoDate = formatDateToYYYYMMDD(displayValue)
                    handleInputChange('client_dob', isoDate)
                  }}
                  placeholder="DD/MM/YYYY"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                    errors.client_dob && "border-red-500"
                  )}
                />
                {errors.client_dob && (
                  <p className="text-red-500 text-sm mt-1">{errors.client_dob}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.client_phone}
                  onChange={(e) => handleInputChange('client_phone', e.target.value)}
                  placeholder="e.g., 012-3456789"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                    errors.client_phone && "border-red-500"
                  )}
                />
                {errors.client_phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.client_phone}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => handleInputChange('client_email', e.target.value)}
                placeholder="client@email.com"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderStep3_CoBorrowers = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Co-Borrowers</h2>
          <p className="text-gray-600 mt-1">Add any co-borrowers or joint applicants (optional)</p>
        </div>

        <CoBorrowerManager
          coBorrowers={formData.co_borrowers}
          onChange={(coBorrowers) => handleInputChange('co_borrowers', coBorrowers)}
        />
      </div>
    )
  }

  const renderFinalReview = () => {
    const base    = parseFloat(formData.home_loan_amount) || 0
    const legal   = formData.finance_legal_cost    ? (parseFloat(formData.legal_cost_amount)    || 0) : 0
    const valuer  = formData.finance_valuation_cost ? (parseFloat(formData.valuation_cost_amount) || 0) : 0
    const cashout = parseFloat(formData.cashout_amount) || 0
    const total   = base + legal + valuer + cashout
    const propertyVal = parseFloat(formData.purchase_price_market_value) || 0

    // ── doc categories ───────────────────────────────────────────────────────
    const DOC_CATEGORIES = [
      {
        key: 'Application Form',
        label: 'Application Form',
        hint: 'Signed bank application form',
        icon: '📄',
      },
      {
        key: 'Personal Document',
        label: 'Personal Documents',
        hint: 'IC / passport (front & back)',
        icon: '🪪',
      },
      {
        key: 'Income Document',
        label: 'Income Documents',
        hint: 'Latest 3 months payslip, EA form, or bank statement',
        icon: '💰',
      },
      {
        key: 'Property Document',
        label: 'Property Documents',
        hint: 'SPA, title deed, valuation report',
        icon: '🏠',
      },
    ]

    const addFiles = (category: string, files: FileList | null) => {
      if (!files) return
      const newDocs = Array.from(files).map(file => ({ type: category, file }))
      setPendingDocs(prev => [...prev, ...newDocs])
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents & Submit</h2>
          <p className="text-gray-600 mt-1">Upload supporting documents, then submit for admin review</p>
        </div>

        {/* ── Case Summary ── */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Case Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Bank</p>
                <p className="font-semibold">{bankConfig?.bankName || formData.selected_bank.replace(/_/g,' ')}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Client</p>
                <p className="font-semibold">{formData.client_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Loan Type</p>
                <p className="font-semibold capitalize">{formData.loan_type || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Property Value</p>
                <p className="font-semibold">{propertyVal > 0 ? `RM ${propertyVal.toLocaleString()}` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total Loan</p>
                <p className="font-semibold text-blue-700">{total > 0 ? `RM ${total.toLocaleString()}` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Tenure</p>
                <p className="font-semibold">{formData.home_loan_tenure ? `${formData.home_loan_tenure} yrs` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Lawyer</p>
                <p className="font-semibold">
                  {formData.selected_lawyer_type === 'panel'
                    ? `Panel — RM ${parseFloat(formData.lawyer_professional_fee || '0').toLocaleString()} fee`
                    : formData.selected_lawyer_type === 'others'
                      ? `Non-Panel — ${formData.lawyer_name_other || '—'}`
                      : '—'}
                </p>
              </div>
              {formData.loan_type === 'refinance' && formData.current_bank_name && (
                <div>
                  <p className="text-gray-500 text-xs">Current Bank</p>
                  <p className="font-semibold">{formData.current_bank_name}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Document Upload — 4 categories ── */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-gray-900">Upload Documents</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Optional at this stage — you can also upload from the case detail page after saving.
              </p>
            </div>

            {DOC_CATEGORIES.map(cat => {
              const catDocs = pendingDocs.filter(d => d.type === cat.key)
              return (
                <div key={cat.key} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{cat.icon} {cat.label}</p>
                      <p className="text-xs text-gray-400">{cat.hint}</p>
                    </div>
                    <label className={cn(
                      'cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    )}>
                      <Upload className="h-3.5 w-3.5" />
                      Add Files
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        className="hidden"
                        onChange={e => addFiles(cat.key, e.target.files)}
                      />
                    </label>
                  </div>
                  {catDocs.length > 0 && (
                    <ul className="space-y-1">
                      {catDocs.map((d, i) => {
                        const globalIdx = pendingDocs.findIndex((p, gi) => p === d && pendingDocs.indexOf(d) === gi)
                        return (
                          <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                            <span className="text-gray-700 truncate max-w-[280px]">{d.file.name}</span>
                            <button
                              type="button"
                              onClick={() => setPendingDocs(prev => prev.filter(p => p !== d))}
                              className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}

            {pendingDocs.length > 0 && (
              <p className="text-xs text-green-600 font-medium">
                ✓ {pendingDocs.length} file{pendingDocs.length > 1 ? 's' : ''} ready to upload on submit
              </p>
            )}
          </CardContent>
        </Card>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>After submission:</strong> Admin will review your case. You cannot edit once submitted unless admin returns it as KIV.
          </p>
        </div>
      </div>
    )
  }

  if (isFetchingCalculation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading calculation data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
              <h1 className="text-3xl font-bold text-gray-900">New Case</h1>
              {calculationId && (
                <p className="text-sm text-blue-600 mt-1">Creating from calculation</p>
              )}
            </div>
            
            {!showPrintView && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Step {currentStep} of {totalSteps}</div>
                  <div className="text-sm font-semibold text-gray-700">{STEP_LABELS[currentStep - 1]}</div>
                </div>
                {autoSaveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin" />Saving…
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle className="w-3 h-3" />Saved
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="text-xs text-red-400">Auto-save failed</span>
                )}
              </div>
            )}
          </div>
        </div>

        {restoredFromCache && !showPrintView && (
          <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <p className="text-sm text-amber-800">
              ↩ Draft restored from your last session
              {savedCaseId && <span className="font-medium"> — already saved</span>}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem(LS_KEY)
                setFormData(initialForm)
                setSavedCaseId(null)
                setSavedCaseData(null)
                setCurrentStep(1)
                setRestoredFromCache(false)
                router.replace('/agent/cases/new')
              }}
              className="text-xs text-amber-700 underline hover:text-amber-900 ml-4 shrink-0"
            >
              Start fresh
            </button>
          </div>
        )}

        {!showPrintView && (
          <div className="mb-8">
            {/* Step pills */}
            <div className="flex items-center gap-1 mb-3 overflow-x-auto">
              {STEP_LABELS.map((label, i) => {
                const step = i + 1
                const done = step < currentStep
                const active = step === currentStep
                return (
                  <React.Fragment key={step}>
                    <div className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                      done   ? 'bg-blue-600 text-white' :
                      active ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                               'bg-gray-100 text-gray-400'
                    )}>
                      {done ? <Check className="h-3 w-3" /> : <span>{step}</span>}
                      {label}
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div className={cn('h-0.5 flex-1 min-w-[8px]', done ? 'bg-blue-600' : 'bg-gray-200')} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
            {/* thin progress bar */}
            <div className="h-1 bg-gray-200 rounded-full">
              <div
                className="h-1 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: ((currentStep / totalSteps) * 100) + '%' }}
              />
            </div>
          </div>
        )}

        {renderCurrentStep()}

        {!showPrintView && (
          <div className="mt-8 flex justify-between items-center">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1 || isLoading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {/* Save as Draft Button - Available at any step, no full validation required */}
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isLoading}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save as Draft
                  </>
                )}
              </Button>
            </div>
            
            <div className="flex gap-3 flex-wrap">
              {/* Render to PDF — disabled for v1. Bank-form PDF rendering is deferred
                  to a professional developer (coordinate overlay is unreliable).
                  Re-enable by restoring the button below once AcroForm approach ships. */}
              {false && savedCaseData && (
                <Button
                  variant="outline"
                  onClick={() => setShowPrintView(true)}
                  className="border-purple-600 text-purple-600 hover:bg-purple-50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Render to PDF
                </Button>
              )}

              {/* Submit — always visible once saved, or on last step */}
              {(savedCaseId || currentStep === totalSteps) && (
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Case
                    </>
                  )}
                </Button>
              )}

              {currentStep < totalSteps && (
                <Button onClick={handleNext} disabled={isLoading}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <NewCasePageInner />
    </Suspense>
  )
}
