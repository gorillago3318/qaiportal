'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X, Save, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getBankFormConfig, getSupportedBanks, BankFormConfig } from '@/config/bank-forms'
import { DynamicBankForm, getTotalSections } from '@/components/dynamic-bank-form'
import { CasePrintView } from '@/components/case-print-view'
import { CoBorrowerManager } from '@/components/co-borrower-manager'

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
  selected_bank: string
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
}

const initialForm: CaseFormData = {
  selected_bank: '',
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
  insurance_type: '',
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
  notes: ''
}

const formatDateToDDMMYYYY = (dateString: string | null): string => {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-')
  return day + '/' + month + '/' + year
}

const formatTenureFromMonths = (months: number | null): string => {
  if (!months) return ''
  const years = Math.floor(months / 12)
  return years.toString()
}

export default function NewCasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const calculationId = searchParams.get('from_calculation')
  
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<CaseFormData>(initialForm)
  const [bankConfig, setBankConfig] = useState<BankFormConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingCalculation, setIsFetchingCalculation] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPrintView, setShowPrintView] = useState(false)
  const [savedCaseData, setSavedCaseData] = useState<any>(null)

  const bankSpecificSteps = bankConfig ? getTotalSections(bankConfig) : 0
  const totalSteps = 2 + bankSpecificSteps

  useEffect(() => {
    if (formData.selected_bank) {
      const config = getBankFormConfig(formData.selected_bank)
      setBankConfig(config || null)
    } else {
      setBankConfig(null)
    }
  }, [formData.selected_bank])

  useEffect(() => {
    if (calculationId) {
      fetchCalculationData(calculationId)
    }
  }, [calculationId])

  const fetchCalculationData = async (calcId: string) => {
    setIsFetchingCalculation(true)
    try {
      const supabase = createClient()
      const { data: calculation, error } = await supabase
        .from('calculations')
        .select('*, proposed_bank:banks(id, name)')
        .eq('id', calcId)
        .single()

      if (error) throw error
      if (!calculation) return

      const calc = calculation as any

      const mappedData: CaseFormData = {
        ...initialForm,
        selected_bank: calc.proposed_bank?.name || '',
        client_title: calc.client_title || 'mr',
        client_name: calc.client_name || '',
        client_ic: calc.client_ic || '',
        client_old_ic: calc.client_old_ic || '',
        client_passport: calc.client_passport || '',
        id_type: calc.id_type || 'nric',
        passport_expiry_date: formatDateToDDMMYYYY(calc.passport_expiry_date),
        client_dob: formatDateToDDMMYYYY(calc.client_dob),
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
    setFormData(prev => ({ ...prev, [field]: value }))
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

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const caseData = {
        agent_id: user.id,
        selected_bank: formData.selected_bank,
        client_title: formData.client_title,
        client_name: formData.client_name,
        id_type: formData.id_type,
        client_ic: formData.client_ic,
        client_old_ic: formData.client_old_ic,
        client_passport: formData.client_passport,
        client_other_id: formData.client_other_id,
        passport_expiry_date: formData.passport_expiry_date,
        client_dob: formData.client_dob,
        gender: formData.gender,
        race: formData.race,
        bumiputra: formData.bumiputra,
        marital_status: formData.marital_status,
        no_of_dependants: parseInt(formData.no_of_dependants) || 0,
        home_address: formData.home_address,
        post_code: formData.post_code,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        years_at_address: parseInt(formData.years_at_address) || 0,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        employment_type: formData.employment_type,
        employer_name: formData.employer_name,
        nature_of_business: formData.nature_of_business,
        occupation: formData.occupation,
        employer_address: formData.employer_address,
        office_tel: formData.office_tel,
        length_service_years: parseInt(formData.length_service_years) || 0,
        length_service_months: parseInt(formData.length_service_months) || 0,
        monthly_income: parseFloat(formData.monthly_income) || 0,
        product_type: formData.product_type,
        loan_purpose: formData.loan_purpose,
        proposed_loan_amount: parseFloat(formData.facility_amount) || 0,
        proposed_tenure_months: parseInt(formData.loan_tenure) * 12 || 0,
        proposed_interest_rate: parseFloat(formData.interest_rate) || 0,
        property_address: formData.property_address,
        property_post_code: formData.property_post_code,
        property_type: formData.property_type,
        property_size_buildup: parseFloat(formData.buildup_size_sqft) || null,
        property_size_land: parseFloat(formData.land_size_sqft) || null,
        property_value: parseFloat(formData.purchase_price) || 0,
        title_type: formData.title_type,
        property_tenure: formData.land_tenure,
        notes: formData.notes,
        status: 'draft'
      }

      const { data, error } = await supabase
        .from('cases')
        .insert([caseData])
        .select()
        .single()

      if (error) throw error

      if (calculationId) {
        await supabase
          .from('calculations')
          .update({ case_id: data.id })
          .eq('id', calculationId)
      }

      setSavedCaseData(data)
      setShowPrintView(true)
    } catch (error) {
      console.error('Error saving case:', error)
      alert('Failed to save case. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderCurrentStep = () => {
    if (showPrintView && savedCaseData) {
      return (
        <CasePrintView
          caseData={savedCaseData}
          onClose={() => {
            setShowPrintView(false)
            router.push('/agent/cases')
          }}
        />
      )
    }

    switch (currentStep) {
      case 1:
        return renderStep1_BankSelection()
      case 2:
        return renderStep2_ClientInfo()
      default:
        if (bankConfig && currentStep > 2 && currentStep <= 2 + bankSpecificSteps) {
          const sectionIndex = currentStep - 3
          const section = bankConfig.sections[sectionIndex]
          if (section) {
            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                    {section.description && (
                      <p className="text-gray-600 mt-1">{section.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    Section {sectionIndex + 1} of {bankSpecificSteps}
                  </div>
                </div>
                
                <Card>
                  <CardContent className="p-6">
                    <DynamicBankForm
                      config={bankConfig}
                      formData={formData}
                      onChange={handleDynamicFormChange}
                      errors={errors}
                      currentSectionIndex={sectionIndex}
                    />
                  </CardContent>
                </Card>
              </div>
            )
          }
        }
        
        if (currentStep === totalSteps) {
          return renderFinalReview()
        }
        
        return null
    }
  }

  const renderStep1_BankSelection = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select Bank</h2>
          <p className="text-gray-600 mt-1">Choose the bank for this case application</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SUPPORTED_BANKS.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => handleInputChange('selected_bank', bank.id)}
                  className={cn(
                    "p-6 border-2 rounded-lg transition-all text-left",
                    formData.selected_bank === bank.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <h3 className="font-semibold text-lg">{bank.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 capitalize">{bank.id.replace(/_/g, ' ')}</p>
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
          <p className="text-gray-600 mt-1">Enter the main applicant's details</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <select
                  value={formData.client_title}
                  onChange={(e) => handleInputChange('client_title', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="mr">Mr</option>
                  <option value="ms">Ms</option>
                  <option value="mrs">Mrs</option>
                  <option value="dr">Dr</option>
                  <option value="prof">Prof</option>
                </select>
              </div>
              
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  placeholder="Enter full name as per NRIC/Passport"
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
                className="w-full md:w-1/3 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="nric">NRIC</option>
                <option value="passport">Passport</option>
                <option value="others">Others</option>
              </select>
            </div>

            {formData.id_type === 'nric' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NRIC Number *</label>
                  <input
                    type="text"
                    value={formData.client_ic}
                    onChange={(e) => handleInputChange('client_ic', e.target.value)}
                    placeholder="e.g., 900101-10-1234"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                      errors.client_ic && "border-red-500"
                    )}
                  />
                  {errors.client_ic && (
                    <p className="text-red-500 text-sm mt-1">{errors.client_ic}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Old NRIC Number</label>
                  <input
                    type="text"
                    value={formData.client_old_ic}
                    onChange={(e) => handleInputChange('client_old_ic', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {formData.id_type === 'passport' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number *</label>
                  <input
                    type="text"
                    value={formData.client_passport}
                    onChange={(e) => handleInputChange('client_passport', e.target.value)}
                    placeholder="e.g., A12345678"
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
                    type="date"
                    value={formData.passport_expiry_date}
                    onChange={(e) => handleInputChange('passport_expiry_date', e.target.value)}
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500",
                      errors.passport_expiry_date && "border-red-500"
                    )}
                  />
                  {errors.passport_expiry_date && (
                    <p className="text-red-500 text-sm mt-1">{errors.passport_expiry_date}</p>
                  )}
                </div>
              </div>
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
                  type="date"
                  value={formData.client_dob}
                  onChange={(e) => handleInputChange('client_dob', e.target.value)}
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

  const renderFinalReview = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>
          <p className="text-gray-600 mt-1">Review all information before submitting the case</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Case Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Bank:</span>
                  <p className="font-medium capitalize">{formData.selected_bank.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-600">Client:</span>
                  <p className="font-medium">{formData.client_name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Loan Amount:</span>
                  <p className="font-medium">RM {parseFloat(formData.facility_amount || '0').toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Tenure:</span>
                  <p className="font-medium">{formData.loan_tenure} years</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Once submitted, this case will be saved as a draft. You can continue editing it later or submit it for processing.
              </p>
            </div>
          </CardContent>
        </Card>
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
              <div className="text-sm text-gray-600">
                Step {currentStep} of {totalSteps}
              </div>
            )}
          </div>
        </div>

        {!showPrintView && (
          <div className="mb-8">
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: ((currentStep / totalSteps) * 100) + '%' }}
              />
            </div>
          </div>
        )}

        {renderCurrentStep()}

        {!showPrintView && (
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1 || isLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            {currentStep === totalSteps ? (
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Submit Case
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={isLoading}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
