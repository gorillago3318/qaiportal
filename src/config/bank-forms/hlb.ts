import { BankFormConfig } from './types'

export const hlbConfig: BankFormConfig = {
  bankId: 'hong_leong_bank',
  bankName: 'Hong Leong Bank',
  sections: [
    {
      id: 'personal_details',
      title: 'Personal Details',
      description: 'Main applicant personal information',
      fields: [
        {
          id: 'client_title',
          label: 'Title',
          type: 'select',
          required: true,
          options: [
            { label: 'Mr', value: 'mr' },
            { label: 'Ms', value: 'ms' },
            { label: 'Mrs', value: 'mrs' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'client_name',
          label: 'Full Name (as per NRIC/Passport)',
          type: 'text',
          required: true,
          gridColumn: 2
        },
        {
          id: 'id_type',
          label: 'ID Type',
          type: 'select',
          required: true,
          options: [
            { label: 'NRIC', value: 'nric' },
            { label: 'Passport', value: 'passport' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'client_ic',
          label: 'NRIC Number',
          type: 'text',
          required: true,
          placeholder: 'e.g., 900101-10-1234',
          gridColumn: 1,
          conditional: {
            field: 'id_type',
            equals: 'nric'
          }
        },
        {
          id: 'client_passport',
          label: 'Passport Number',
          type: 'text',
          required: true,
          placeholder: 'e.g., A12345678',
          gridColumn: 1,
          conditional: {
            field: 'id_type',
            equals: 'passport'
          }
        },
        {
          id: 'client_other_id',
          label: 'Other ID Number',
          type: 'text',
          required: true,
          placeholder: 'Enter ID number',
          gridColumn: 1,
          conditional: {
            field: 'id_type',
            equals: 'others'
          }
        },
        {
          id: 'passport_expiry_date',
          label: 'Passport Expiry Date (DD/MM/YYYY)',
          type: 'date',
          required: true,
          gridColumn: 1,
          conditional: {
            field: 'id_type',
            equals: 'passport'
          }
        },
        {
          id: 'client_dob',
          label: 'Date of Birth (DD/MM/YYYY)',
          type: 'date',
          required: true,
          gridColumn: 1
        },
        {
          id: 'gender',
          label: 'Gender',
          type: 'radio',
          required: true,
          options: [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' }
          ],
          gridColumn: 1
        },
        {
          id: 'race',
          label: 'Race',
          type: 'select',
          required: true,
          options: [
            { label: 'Malay', value: 'malay' },
            { label: 'Chinese', value: 'chinese' },
            { label: 'Indian', value: 'indian' },
            { label: 'Pribumi', value: 'pribumi' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'bumiputra',
          label: 'Bumiputra Status',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 1
        },
        {
          id: 'marital_status',
          label: 'Marital Status',
          type: 'select',
          required: true,
          options: [
            { label: 'Single', value: 'single' },
            { label: 'Married', value: 'married' },
            { label: 'Divorced', value: 'divorced' },
            { label: 'Widowed', value: 'widowed' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'no_of_dependants',
          label: 'Number of Dependants',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'residency_status',
          label: 'Residency Status / Citizenship',
          type: 'select',
          required: true,
          options: [
            { label: 'Malaysian Citizen', value: 'citizen' },
            { label: 'Permanent Resident', value: 'pr' },
            { label: 'Non-Malaysian Resident', value: 'non_malaysian_resident' },
            { label: 'Non-Resident', value: 'non_resident' }
          ],
          gridColumn: 2
        },
        {
          id: 'home_address',
          label: 'Home Address',
          type: 'textarea',
          required: true,
          gridColumn: 2
        },
        {
          id: 'post_code',
          label: 'Post Code',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'city',
          label: 'City',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'state',
          label: 'State',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'country',
          label: 'Country',
          type: 'text',
          required: true,
          defaultValue: 'Malaysia',
          gridColumn: 1
        },
        {
          id: 'years_at_address',
          label: 'Years at Current Address',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'correspondence_same_as_home',
          label: 'Correspondence Address Same as Home',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        },
        {
          id: 'correspondence_address',
          label: 'Correspondence Address',
          type: 'textarea',
          required: false,
          conditional: { field: 'correspondence_same_as_home', equals: 'no' },
          gridColumn: 2
        },
        {
          id: 'client_phone',
          label: 'Mobile Phone Number (Mandatory)',
          type: 'tel',
          required: true,
          gridColumn: 1
        },
        {
          id: 'client_email',
          label: 'Email Address (Mandatory)',
          type: 'email',
          required: true,
          gridColumn: 1
        }
      ]
    },
    {
      id: 'employment_details',
      title: 'Employment Details',
      description: 'Employment and income information',
      fields: [
        {
          id: 'employment_type',
          label: 'Employment Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Salaried', value: 'salaried' },
            { label: 'Professional', value: 'professional' },
            { label: 'Self-Employed', value: 'self_employed' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'employer_name',
          label: 'Employer Name / Business Entity',
          type: 'text',
          required: true,
          gridColumn: 2
        },
        {
          id: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          required: true,
          gridColumn: 2
        },
        {
          id: 'occupation',
          label: 'Occupation / Position',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'employer_address',
          label: 'Employer Address',
          type: 'textarea',
          required: false,
          gridColumn: 2
        },
        {
          id: 'office_tel',
          label: 'Office Telephone Number',
          type: 'tel',
          required: false,
          gridColumn: 1
        },
        {
          id: 'length_service_years',
          label: 'Length of Service - Years',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'length_service_months',
          label: 'Length of Service - Months',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'monthly_income',
          label: 'Monthly Income (RM)',
          type: 'currency',
          required: true,
          gridColumn: 1
        },
        {
          id: 'company_establishment_date',
          label: 'Company Establishment Date (DD/MM/YYYY)',
          type: 'date',
          required: false,
          conditional: { field: 'employment_type', equals: 'self_employed' },
          gridColumn: 1
        },
        {
          id: 'prev_employer_name',
          label: 'Previous Employer Name (if current < 1 year)',
          type: 'text',
          required: false,
          gridColumn: 2,
          conditional: { 
            field: 'length_service_years', 
            custom_logic: (formData) => {
              const years = parseInt(formData.length_service_years) || 0;
              const months = parseInt(formData.length_service_months) || 0;
              return (years < 1) || (years === 0 && months < 12);
            }
          }
        },
        {
          id: 'prev_nature_of_business',
          label: 'Previous Nature of Business',
          type: 'text',
          required: false,
          gridColumn: 2,
          conditional: { 
            field: 'length_service_years', 
            custom_logic: (formData) => {
              const years = parseInt(formData.length_service_years) || 0;
              const months = parseInt(formData.length_service_months) || 0;
              return (years < 1) || (years === 0 && months < 12);
            }
          }
        },
        {
          id: 'prev_occupation',
          label: 'Previous Occupation',
          type: 'text',
          required: false,
          gridColumn: 1,
          conditional: { 
            field: 'length_service_years', 
            custom_logic: (formData) => {
              const years = parseInt(formData.length_service_years) || 0;
              const months = parseInt(formData.length_service_months) || 0;
              return (years < 1) || (years === 0 && months < 12);
            }
          }
        },
        {
          id: 'prev_length_service',
          label: 'Previous Length of Service (Years)',
          type: 'number',
          required: false,
          gridColumn: 1,
          conditional: { 
            field: 'length_service_years', 
            custom_logic: (formData) => {
              const years = parseInt(formData.length_service_years) || 0;
              const months = parseInt(formData.length_service_months) || 0;
              return (years < 1) || (years === 0 && months < 12);
            }
          }
        }
      ]
    },
    {
      id: 'loan_requirement',
      title: 'Financing Details',
      description: 'Loan product and financing requirements',
      fields: [
        {
          id: 'product_type',
          label: 'Product Type',
          type: 'radio',
          required: true,
          options: [
            { label: 'Conventional Loan', value: 'conventional' },
            { label: 'Islamic Financing', value: 'islamic' }
          ],
          gridColumn: 2
        },
        {
          id: 'conventional_product',
          label: 'Conventional Product',
          type: 'select',
          required: false,
          conditional: { field: 'product_type', equals: 'conventional' },
          options: [
            { label: 'Hong Leong Housing Loan', value: 'housing_loan' },
            { label: 'Hong Leong MortgagePlus Housing Loan', value: 'mortgageplus_housing' },
            { label: 'Hong Leong Shop Loan', value: 'shop_loan' },
            { label: 'Hong Leong MortgagePlus Shop Loan', value: 'mortgageplus_shop' },
            { label: 'Hong Leong Special Housing Loan', value: 'special_housing' },
            { label: 'HLB Solar Plus Loan', value: 'solar_plus' },
            { label: 'Housing Guarantee Scheme by SJKP', value: 'sjkp' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'islamic_product',
          label: 'Islamic Financing Product',
          type: 'select',
          required: false,
          conditional: { field: 'product_type', equals: 'islamic' },
          options: [
            { label: 'Hong Leong CM Flexi Property Financing-i', value: 'cm_flexi' },
            { label: 'House Financing-i', value: 'house_financing' },
            { label: 'Shop Financing-i', value: 'shop_financing' },
            { label: 'Special Housing Financing-i', value: 'special_housing_i' },
            { label: 'Housing Guarantee Scheme by SJKP-i', value: 'sjkp_i' },
            { label: 'HLB Solar Plus Financing-i', value: 'solar_plus_i' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'purpose_of_financing',
          label: 'Purpose of Financing',
          type: 'select',
          required: true,
          options: [
            { label: 'Purchase for Own Use', value: 'purchase_own' },
            { label: 'Purchase for Business Use', value: 'purchase_business' },
            { label: 'Purchase for Investment', value: 'purchase_investment' },
            { label: 'Refinancing/Top Up', value: 'refinance' },
            { label: 'Renovation', value: 'renovation' },
            { label: 'Solar Panel Financing', value: 'solar_panel' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'facility_type',
          label: 'Facility Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Term Loan/Financing', value: 'term_loan' },
            { label: 'Overdraft', value: 'overdraft' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'facility_amount',
          label: 'Facility Amount (RM)',
          type: 'currency',
          required: true,
          gridColumn: 1
        },
        {
          id: 'facility_tenure_months',
          label: 'Tenure',
          type: 'number',
          required: true,
          placeholder: 'Enter in months (e.g., 60 for 5 years)',
          gridColumn: 1,
          validation: {
            min: 12,
            max: 420 // 35 years max
          }
        },
        {
          id: 'finance_legal_cost',
          label: 'Finance Legal Cost by Bank',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 1
        },
        {
          id: 'legal_cost_amount',
          label: 'Legal Cost Amount (RM) - Quotation Required',
          type: 'currency',
          required: true,
          placeholder: 'Enter quoted legal cost amount',
          conditional: { field: 'finance_legal_cost', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'finance_valuation_cost',
          label: 'Finance Valuation Cost by Bank',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 1
        },
        {
          id: 'valuation_cost_amount',
          label: 'Valuation Cost Amount (RM) - Quotation Required',
          type: 'currency',
          required: true,
          placeholder: 'Enter quoted valuation cost amount',
          conditional: { field: 'finance_valuation_cost', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'current_bank_name',
          label: 'Current Bank Name (for Refinancing)',
          type: 'select',
          required: false,
          options: [
            { label: 'Maybank', value: 'Maybank' },
            { label: 'CIMB Bank', value: 'CIMB Bank' },
            { label: 'Public Bank', value: 'Public Bank' },
            { label: 'RHB Bank', value: 'RHB Bank' },
            { label: 'Hong Leong Bank', value: 'Hong Leong Bank' },
            { label: 'AmBank', value: 'AmBank' },
            { label: 'OCBC Bank', value: 'OCBC Bank' },
            { label: 'UOB Malaysia', value: 'UOB Malaysia' },
            { label: 'Standard Chartered', value: 'Standard Chartered' },
            { label: 'HSBC Bank Malaysia', value: 'HSBC Bank Malaysia' },
            { label: 'Alliance Bank', value: 'Alliance Bank' },
            { label: 'Affin Bank', value: 'Affin Bank' },
            { label: 'Bank Islam', value: 'Bank Islam' },
            { label: 'Bank Muamalat', value: 'Bank Muamalat' },
            { label: 'BSN', value: 'BSN' },
            { label: 'MBSB Bank', value: 'MBSB Bank' },
            { label: 'Citibank Malaysia', value: 'Citibank Malaysia' }
          ],
          placeholder: 'Select current bank',
          gridColumn: 2
        },
        {
          id: 'insurance_type',
          label: 'Insurance/Takaful Type',
          type: 'select',
          required: false,
          options: [
            { label: 'MDTA', value: 'mdta' },
            { label: 'MRTT', value: 'mrtt' },
            { label: 'MLTA', value: 'mlta' },
            { label: 'MLTT', value: 'mltt' },
            { label: 'None', value: 'none' }
          ],
          gridColumn: 1
        },
        {
          id: 'insurance_financed_by',
          label: 'Insurance Financed By',
          type: 'select',
          required: false,
          options: [
            { label: 'Bank', value: 'bank' },
            { label: 'Self-Financed', value: 'self' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 1,
          conditional: { field: 'insurance_type', not_equals: 'none' }
        },
        {
          id: 'insurance_premium_amount',
          label: 'Total Premium/Contribution Amount (RM)',
          type: 'currency',
          required: false,
          gridColumn: 1,
          conditional: { field: 'insurance_type', not_equals: 'none' }
        },
        {
          id: 'insurance_term_months',
          label: 'Term Insured/Covered (Months)',
          type: 'number',
          required: false,
          gridColumn: 1,
          conditional: { field: 'insurance_type', not_equals: 'none' }
        },
        {
          id: 'deferment_period_months',
          label: 'Deferment Period (Months)',
          type: 'number',
          required: false,
          gridColumn: 1,
          conditional: { field: 'insurance_type', not_equals: 'none' }
        },
        {
          id: 'sum_insured_main',
          label: 'Sum Insured - Main Applicant (RM)',
          type: 'currency',
          required: false,
          gridColumn: 1,
          conditional: { field: 'insurance_type', not_equals: 'none' }
        },
        {
          id: 'sum_insured_joint',
          label: 'Sum Insured - Joint Applicant (RM)',
          type: 'currency',
          required: false,
          gridColumn: 1,
          conditional: { field: 'insurance_type', not_equals: 'none' }
        }
      ]
    },
    {
      id: 'property_details',
      title: 'Property Details',
      description: 'Enter property information',
      fields: [
        {
          id: 'property_subtype',
          label: 'Property Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Terrace/Link House', value: 'terrace' },
            { label: 'Cluster House', value: 'cluster' },
            { label: 'Semi Detached', value: 'semi_detached' },
            { label: 'Bungalow', value: 'bungalow' },
            { label: 'Townhouse', value: 'townhouse' },
            { label: 'Service Apartment', value: 'service_apt' },
            { label: 'Condominium', value: 'condo' },
            { label: 'Apartment', value: 'apartment' },
            { label: 'Flat', value: 'flat' },
            { label: 'Bungalow Land', value: 'bungalow_land' },
            { label: 'Shop Apartment', value: 'shop_apt' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'no_of_storey',
          label: 'Number of Storeys',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'financing_type',
          label: 'Financing Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Purchase from Developer', value: 'purchase_developer' },
            { label: 'Subsales', value: 'subsales' },
            { label: 'Refinancing/Top Up', value: 'refinance' },
            { label: 'Purchase from Auction', value: 'auction' }
          ],
          gridColumn: 1
        },
        {
          id: 'built_type',
          label: 'Built Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Intermediate Lot', value: 'intermediate' },
            { label: 'Corner Lot', value: 'corner' },
            { label: 'End Lot', value: 'end_lot' },
            { label: 'Individual Designed', value: 'individual_designed' }
          ],
          gridColumn: 1
        },
        {
          id: 'construction_stage',
          label: 'Construction Stage',
          type: 'select',
          required: true,
          options: [
            { label: 'Completed', value: 'completed' },
            { label: 'Under Construction', value: 'under_construction' }
          ],
          gridColumn: 1
        },
        {
          id: 'percent_completed',
          label: '% Completed',
          type: 'percentage',
          required: false,
          conditional: { field: 'construction_stage', equals: 'under_construction' },
          gridColumn: 1
        },
        {
          id: 'project_name',
          label: 'Project Name',
          type: 'text',
          required: false,
          gridColumn: 2
        },
        {
          id: 'developer_seller_name',
          label: 'Developer/Seller Name',
          type: 'text',
          required: false,
          gridColumn: 2
        },
        {
          id: 'property_address',
          label: 'Property Address',
          type: 'textarea',
          required: true,
          gridColumn: 2
        },
        {
          id: 'property_post_code',
          label: 'Post Code',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'property_city',
          label: 'City',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'property_state',
          label: 'State',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'property_country',
          label: 'Country',
          type: 'text',
          required: true,
          defaultValue: 'Malaysia',
          gridColumn: 1
        },
        {
          id: 'purchase_price',
          label: 'Purchase Price (RM)',
          type: 'currency',
          required: true,
          gridColumn: 1
        },
        {
          id: 'first_house',
          label: 'First House',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 1
        },
        {
          id: 'land_size_sqft',
          label: 'Land Area (Sq Ft)',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'buildup_size_sqft',
          label: 'Built-up Area (Sq Ft)',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'age_of_building',
          label: 'Age of Building (Years)',
          type: 'number',
          required: false,
          gridColumn: 1
        },
        {
          id: 'construction_cost',
          label: 'Construction Cost (RM)',
          type: 'currency',
          required: false,
          gridColumn: 1
        },
        {
          id: 'spa_date',
          label: 'SPA Date/Booking Receipt Date (DD/MM/YYYY)',
          type: 'date',
          required: false,
          gridColumn: 1
        },
        {
          id: 'leasehold_expiry_date',
          label: 'Leasehold Expiry Date (DD/MM/YYYY)',
          type: 'date',
          required: false,
          gridColumn: 1
        }
      ]
    },
    {
      id: 'title_details',
      title: 'Title Details',
      description: 'Property title information',
      fields: [
        {
          id: 'title_type',
          label: 'Title Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Master', value: 'master' },
            { label: 'Individual', value: 'individual' },
            { label: 'Strata', value: 'strata' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'title_no',
          label: 'Title Number',
          type: 'text',
          required: false,
          gridColumn: 1
        },
        {
          id: 'title_lot_no',
          label: 'Title Lot Number',
          type: 'text',
          required: false,
          gridColumn: 1
        },
        {
          id: 'mukim',
          label: 'Mukim',
          type: 'text',
          required: false,
          gridColumn: 1
        },
        {
          id: 'district',
          label: 'District',
          type: 'text',
          required: false,
          gridColumn: 1
        },
        {
          id: 'land_tenure',
          label: 'Land Tenure',
          type: 'select',
          required: true,
          options: [
            { label: 'Freehold', value: 'freehold' },
            { label: 'Leasehold', value: 'leasehold' }
          ],
          gridColumn: 1
        },
        {
          id: 'title_restriction',
          label: 'Title Transfer Restriction',
          type: 'select',
          required: true,
          options: [
            { label: 'No Restriction', value: 'no_restriction' },
            { label: 'State Consent', value: 'state_consent' },
            { label: 'Malay Customary', value: 'malay_customary' },
            { label: 'Malay Reserve', value: 'malay_reserve' },
            { label: 'Bumiputra Lot', value: 'bumiputra_lot' },
            { label: 'Native', value: 'native' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'title_restriction_details',
          label: 'Restriction Details (if applicable)',
          type: 'text',
          required: false,
          conditional: { field: 'title_restriction', equals: 'others' },
          gridColumn: 2
        },
        {
          id: 'land_use',
          label: 'Land Use',
          type: 'select',
          required: true,
          options: [
            { label: 'Residential', value: 'residential' },
            { label: 'Commercial', value: 'commercial' },
            { label: 'Industrial', value: 'industrial' },
            { label: 'Agricultural', value: 'agricultural' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        }
      ]
    },
    {
      id: 'other_financing',
      title: 'Other Financing Facilities',
      description: 'List all existing financial commitments from other institutions',
      fields: [
        {
          id: 'has_other_commitments',
          label: 'Do you have other outstanding loans/financing?',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        },
        {
          id: 'other_commitments_details',
          label: 'Other Commitments Details (Bank, Type, Amount, Outstanding)',
          type: 'textarea',
          required: false,
          conditional: { field: 'has_other_commitments', equals: 'yes' },
          placeholder: 'e.g., Maybank - Personal Loan - RM 50,000 - Outstanding RM 30,000',
          gridColumn: 2
        }
      ]
    },
    {
      id: 'co_borrower_section',
      title: 'Co-Borrower Information',
      description: 'Add co-borrowers/guarantors if applicable (Note: This section is managed dynamically in the form)',
      fields: [
        {
          id: 'has_co_borrower',
          label: 'Do you have a co-borrower/guarantor?',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        },
        {
          id: 'co_borrower_note',
          label: 'Note',
          type: 'text',
          required: false,
          defaultValue: 'Co-borrower details will be collected in a separate dynamic form with full personal and employment information.',
          gridColumn: 2
        }
      ]
    },
    {
      id: 'lawyer_valuer',
      title: 'Lawyer & Valuer Information',
      description: 'Professional service providers for this application',
      fields: [
        {
          id: 'has_lawyer',
          label: 'Do you have an appointed lawyer?',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        },
        {
          id: 'lawyer_name',
          label: 'Lawyer Name',
          type: 'text',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'lawyer_firm',
          label: 'Law Firm Name',
          type: 'text',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'lawyer_contact',
          label: 'Lawyer Contact Number',
          type: 'tel',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'lawyer_email',
          label: 'Lawyer Email',
          type: 'email',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'has_valuer',
          label: 'Do you have an appointed valuer?',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No, need quotation', value: 'need_quotation' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        },
        {
          id: 'valuer_name',
          label: 'Valuer Name',
          type: 'text',
          required: false,
          conditional: { field: 'has_valuer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'valuer_firm',
          label: 'Valuation Firm Name',
          type: 'text',
          required: false,
          conditional: { field: 'has_valuer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'valuer_contact',
          label: 'Valuer Contact Number',
          type: 'tel',
          required: false,
          conditional: { field: 'has_valuer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'valuer_email',
          label: 'Valuer Email',
          type: 'email',
          required: false,
          conditional: { field: 'has_valuer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'valuation_fee_quoted',
          label: 'Valuation Fee Quoted (RM)',
          type: 'currency',
          required: false,
          conditional: { field: 'has_valuer', equals: 'yes' },
          gridColumn: 1
        }
      ]
    }
  ]
}
