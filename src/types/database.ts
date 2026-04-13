export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'agency_manager'
  | 'unit_manager'
  | 'senior_agent'
  | 'agent'

export type LoanType = 'refinance' | 'subsale' | 'developer'

export type CaseStatus =
  | 'draft'
  | 'submitted'
  | 'bank_processing'
  | 'kiv'
  | 'approved'
  | 'declined'
  | 'accepted'
  | 'rejected'
  | 'pending_execution'
  | 'executed'
  | 'payment_pending'
  | 'paid'

export type CommissionType = 'bank' | 'lawyer'

export type CommissionStatus =
  | 'pending'
  | 'calculated'
  | 'payment_pending'
  | 'paid'

export type LawyerCaseType = 'la' | 'spa' | 'mot'

export type Gender = 'male' | 'female'

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'

export type ResidencyStatus = 'citizen' | 'pr' | 'temp' | 'foreigner'

export type LoanTenureType = 'term' | 'flexi' | 'semi_flexi'

export type PropertyTitle = 'individual' | 'strata'

export type PropertyTenure = 'freehold' | 'leasehold'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          role: UserRole
          agent_code: string | null
          upline_id: string | null
          is_active: boolean
          bank_name: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['profiles']['Row'],
          'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      commission_tier_config: {
        Row: {
          id: string
          tier: UserRole
          percentage: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['commission_tier_config']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<
          Database['public']['Tables']['commission_tier_config']['Insert']
        >
      }
      banks: {
        Row: {
          id: string
          name: string
          commission_rate: number
          interest_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['banks']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['banks']['Insert']>
      }
      lawyers: {
        Row: {
          id: string
          name: string
          firm: string
          phone: string | null
          email: string | null
          la_fee: number | null
          spa_fee: number | null
          mot_fee: number | null
          is_panel: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['lawyers']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['lawyers']['Insert']>
      }
      clients: {
        Row: {
          id: string
          full_name: string
          ic_number: string
          phone: string
          email: string | null
          date_of_birth: string | null
          gender: Gender | null
          marital_status: MaritalStatus | null
          residency_status: ResidencyStatus | null
          address: string | null
          employer: string | null
          monthly_income: number | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['clients']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
      }
      calculations: {
        Row: {
          id: string
          agent_id: string
          client_id: string | null
          client_name: string
          client_ic: string | null
          client_phone: string | null
          client_dob: string | null
          loan_type: LoanType
          current_bank: string | null
          current_loan_amount: number | null
          current_interest_rate: number | null
          current_monthly_instalment: number | null
          current_tenure_months: number | null
          proposed_bank_id: string | null
          proposed_loan_amount: number | null
          proposed_interest_rate: number | null
          proposed_tenure_months: number | null
          has_cash_out: boolean
          cash_out_amount: number | null
          cash_out_tenure_months: number | null
          finance_legal_fees: boolean
          legal_fee_amount: number | null
          valuation_fee_amount: number | null
          stamp_duty_amount: number | null
          results: Record<string, unknown> | null
          report_token: string | null
          report_url: string | null
          referral_code: string | null
          converted_to_case_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['calculations']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['calculations']['Insert']>
      }
      cases: {
        Row: {
          id: string
          case_code: string
          calculation_id: string | null
          agent_id: string
          client_id: string
          loan_type: LoanType
          status: CaseStatus
          current_bank: string | null
          current_loan_amount: number | null
          current_interest_rate: number | null
          current_monthly_instalment: number | null
          current_tenure_months: number | null
          loan_type_detail: LoanTenureType | null
          is_islamic: boolean
          has_lock_in: boolean
          property_address: string | null
          property_type: string | null
          property_title: PropertyTitle | null
          property_tenure: PropertyTenure | null
          property_value: number | null
          property_size_land: number | null
          property_size_buildup: number | null
          proposed_bank_id: string | null
          proposed_loan_amount: number | null
          proposed_interest_rate: number | null
          proposed_tenure_months: number | null
          has_cash_out: boolean
          cash_out_amount: number | null
          cash_out_tenure_months: number | null
          lawyer_id: string | null
          lawyer_name_other: string | null
          lawyer_firm_other: string | null
          lawyer_case_types: LawyerCaseType[]
          lawyer_professional_fee: number | null
          lawyer_discount: number | null
          has_lawyer_discount: boolean
          lawyer_discount_amount: number | null
          lawyer_quotation_url: string | null
          valuer_name: string | null
          valuer_firm: string | null
          valuer_1_firm: string | null
          valuer_1_name: string | null
          valuer_1_date: string | null
          valuer_1_amount: number | null
          valuer_2_firm: string | null
          valuer_2_name: string | null
          valuer_2_date: string | null
          valuer_2_amount: number | null
          finance_legal_fees: boolean
          legal_fee_amount: number | null
          valuation_fee_amount: number | null
          stamp_duty_amount: number | null
          has_co_broke: boolean
          admin_remarks: string | null
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['cases']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['cases']['Insert']>
      }
      co_borrowers: {
        Row: {
          id: string
          case_id: string
          full_name: string
          ic_number: string
          phone: string | null
          email: string | null
          role: 'co_borrower' | 'guarantor' | 'charger'
          relationship: string | null
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['co_borrowers']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<Database['public']['Tables']['co_borrowers']['Insert']>
      }
      case_co_broke: {
        Row: {
          id: string
          case_id: string
          referrer_agent_id: string
          doer_agent_id: string
          referrer_share: number
          doer_share: number
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['case_co_broke']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<Database['public']['Tables']['case_co_broke']['Insert']>
      }
      case_status_history: {
        Row: {
          id: string
          case_id: string
          from_status: CaseStatus | null
          to_status: CaseStatus
          changed_by: string
          notes: string | null
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['case_status_history']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<
          Database['public']['Tables']['case_status_history']['Insert']
        >
      }
      case_comments: {
        Row: {
          id: string
          case_id: string
          author_id: string
          content: string
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['case_comments']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['case_comments']['Insert']>
      }
      case_documents: {
        Row: {
          id: string
          case_id: string
          document_type: string
          file_name: string
          file_url: string
          file_size: number | null
          uploaded_by: string
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['case_documents']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<Database['public']['Tables']['case_documents']['Insert']>
      }
      commissions: {
        Row: {
          id: string
          case_id: string
          type: CommissionType
          gross_amount: number
          company_cut: number
          discount_amount: number
          net_distributable: number
          tier_breakdown: Record<string, unknown>
          status: CommissionStatus
          paid_amount: number | null
          paid_at: string | null
          payment_reference: string | null
          commission_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['commissions']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['commissions']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          case_id: string | null
          title: string
          message: string
          is_read: boolean
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['notifications']['Row'],
          'id' | 'created_at'
        >
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      loan_type: LoanType
      case_status: CaseStatus
      commission_type: CommissionType
      commission_status: CommissionStatus
      lawyer_case_type: LawyerCaseType
      gender: Gender
      marital_status: MaritalStatus
      residency_status: ResidencyStatus
      loan_tenure_type: LoanTenureType
      property_title: PropertyTitle
      property_tenure: PropertyTenure
    }
  }
}

// ==================== Convenience Row Types ====================

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Bank = Database['public']['Tables']['banks']['Row']
export type Lawyer = Database['public']['Tables']['lawyers']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type Calculation = Database['public']['Tables']['calculations']['Row']
export type Case = Database['public']['Tables']['cases']['Row']
export type CoBorrower = Database['public']['Tables']['co_borrowers']['Row']
export type CoCrokeRecord = Database['public']['Tables']['case_co_broke']['Row']
export type CaseStatusHistoryRecord =
  Database['public']['Tables']['case_status_history']['Row']
export type CaseComment = Database['public']['Tables']['case_comments']['Row']
export type CaseDocument = Database['public']['Tables']['case_documents']['Row']
export type Commission = Database['public']['Tables']['commissions']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type CommissionTierConfig =
  Database['public']['Tables']['commission_tier_config']['Row']

// ==================== Extended / Joined Types ====================

export type CaseWithClient = Case & {
  client: Client
  agent: Pick<Profile, 'id' | 'full_name' | 'agent_code' | 'email' | 'phone'>
  proposed_bank: Pick<Bank, 'id' | 'name'> | null
}

export type CommissionWithCase = Commission & {
  case: Pick<Case, 'id' | 'case_code' | 'loan_type'>
}

export type ProfileWithUpline = Profile & {
  upline: Pick<Profile, 'id' | 'full_name' | 'role' | 'agent_code'> | null
}

// ==================== Status Label Map ====================

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  bank_processing: 'Bank Processing',
  kiv: 'KIV',
  approved: 'Approved',
  declined: 'Declined',
  accepted: 'Accepted',
  rejected: 'Rejected',
  pending_execution: 'Pending Execution',
  executed: 'Executed',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  refinance: 'Refinance',
  subsale: 'Subsale',
  developer: 'Developer Purchase',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  agency_manager: 'Agency Manager',
  unit_manager: 'Unit Manager',
  senior_agent: 'Senior Agent',
  agent: 'Agent',
}
