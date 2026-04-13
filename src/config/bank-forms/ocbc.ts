import { BankFormConfig } from './types'

export const ocbcConfig: BankFormConfig = {
  bankId: 'ocbc',
  bankName: 'OCBC Bank',
  sections: [
    // Section 1: Personal Details (moved from position 4)
    {
      id: 'applicant_personal',
      title: 'Personal Details - Applicant 1 (Main Applicant)',
      description: 'Main applicant personal information',
      fields: [
        {
          id: 'client_name',
          label: 'Full Name',
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
          label: 'Date of Birth',
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
            { label: 'Others', value: 'others' }
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
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'residency_status',
          label: 'Nationality / Residency Status',
          type: 'select',
          required: true,
          options: [
            { label: 'Malaysian Citizen', value: 'citizen' },
            { label: 'Non-Malaysian Resident', value: 'non_malaysian_resident' },
            { label: 'Resident', value: 'resident' },
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
          id: 'correspondence_address',
          label: 'Correspondence Address',
          type: 'textarea',
          required: false,
          gridColumn: 2
        },
        {
          id: 'contact_numbers',
          label: 'Contact Numbers',
          type: 'tel',
          required: true,
          gridColumn: 1
        },
        {
          id: 'client_email',
          label: 'Email Address',
          type: 'email',
          required: true,
          gridColumn: 1
        }
      ]
    },
    // Section 2: Employment Details (moved from position 5)
    {
      id: 'employment_details',
      title: 'Employment Details',
      description: 'Employment information for all applicants/guarantors',
      fields: [
        {
          id: 'employment_type',
          label: 'Employment Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Salaried', value: 'salaried' },
            { label: 'Commission Earner', value: 'commission' },
            { label: 'Self-employed', value: 'self_employed' },
            { label: 'Retiree', value: 'retiree' },
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
          label: 'Nature of Business / Position',
          type: 'text',
          required: true,
          gridColumn: 2
        },
        {
          id: 'office_address',
          label: 'Office Address',
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
          id: 'prev_employer_details',
          label: 'Previous Employer Details (if current employment < 6 months)',
          type: 'textarea',
          required: false,
          gridColumn: 2
        }
      ]
    },
    // Section 3: Financing Details (moved from position 1)
    {
      id: 'financing_details',
      title: 'Financing Details / Requirement',
      description: 'Select product and financing requirements',
      fields: [
        {
          id: 'product_type',
          label: 'Product Type',
          type: 'radio',
          required: true,
          options: [
            { label: 'Conventional', value: 'conventional' },
            { label: 'Islamic (Al-Amin)', value: 'islamic' }
          ],
          gridColumn: 2
        },
        {
          id: 'purpose',
          label: 'Purpose',
          type: 'select',
          required: true,
          options: [
            { label: 'Purchase', value: 'purchase' },
            { label: 'Refinance & Cash Out', value: 'refinance_cashout' },
            { label: 'Top Up', value: 'topup' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'loan_type',
          label: 'Loan/Financing Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Housing / Term Loan', value: 'housing_term' },
            { label: 'Overdraft', value: 'overdraft' },
            { label: 'Overdraft Against Property', value: 'overdraft_property' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'refinance_purpose',
          label: 'Refinance & Cash Out Purpose (if applicable)',
          type: 'select',
          required: false,
          conditional: { field: 'purpose', equals: 'refinance_cashout' },
          options: [
            { label: 'Paydown existing loan', value: 'paydown' },
            { label: 'Renovation/repair/home improvement', value: 'renovation' },
            { label: 'Education', value: 'education' },
            { label: 'Medical bills', value: 'medical' },
            { label: 'Investment', value: 'investment' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 2
        },
        {
          id: 'financing_amount',
          label: 'Financing Amount (RM)',
          type: 'currency',
          required: true,
          gridColumn: 1
        },
        {
          id: 'tenure_years',
          label: 'Tenure (Years)',
          type: 'number',
          required: true,
          gridColumn: 1
        },
        {
          id: 'installment_rental',
          label: 'Installment/Rental (if applicable) (RM)',
          type: 'currency',
          required: false,
          gridColumn: 2
        }
      ]
    },
    // Section 4: Collateral / Property Details (moved from position 2)
    {
      id: 'collateral_property',
      title: 'Collateral / Property Details',
      description: 'Property information for security',
      fields: [
        {
          id: 'property_owner_names',
          label: 'Property Owner Name(s)',
          type: 'text',
          required: true,
          gridColumn: 2
        },
        {
          id: 'property_address',
          label: 'Address',
          type: 'textarea',
          required: true,
          gridColumn: 2
        },
        {
          id: 'property_postcode',
          label: 'Postcode',
          type: 'text',
          required: true,
          gridColumn: 1
        },
        {
          id: 'property_type',
          label: 'Property Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Terraced / Link House', value: 'terraced' },
            { label: 'Semi-detached', value: 'semi_detached' },
            { label: 'Bungalow', value: 'bungalow' },
            { label: 'Condominium', value: 'condominium' },
            { label: 'Apartment', value: 'apartment' },
            { label: 'Service Apartment', value: 'service_apt' },
            { label: 'Others', value: 'others' }
          ],
          gridColumn: 1
        },
        {
          id: 'buildup_area',
          label: 'Built-up Area',
          type: 'text',
          required: false,
          placeholder: 'e.g., 1500 sq ft',
          gridColumn: 1
        },
        {
          id: 'land_area',
          label: 'Land Area',
          type: 'text',
          required: false,
          placeholder: 'e.g., 2000 sq ft',
          gridColumn: 1
        },
        {
          id: 'purchase_price_market_value',
          label: 'Purchase Price / Current Market Value (RM)',
          type: 'currency',
          required: true,
          gridColumn: 1
        },
        {
          id: 'type_of_purchase',
          label: 'Type of Purchase',
          type: 'select',
          required: true,
          options: [
            { label: 'Purchase from Developer', value: 'developer' },
            { label: 'Subsales', value: 'subsales' },
            { label: 'Refinancing/Top Up', value: 'refinance' },
            { label: 'Others', value: 'others' }
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
          id: 'age_of_property',
          label: 'Age of Property (years)',
          type: 'number',
          required: false,
          gridColumn: 1
        },
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
          id: 'land_type',
          label: 'Land Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Freehold', value: 'freehold' },
            { label: 'Leasehold', value: 'leasehold' }
          ],
          gridColumn: 1
        },
        {
          id: 'leasehold_expiry_date',
          label: 'Leasehold Expiry Date',
          type: 'date',
          required: false,
          conditional: { field: 'land_type', equals: 'leasehold' },
          gridColumn: 1
        },
        {
          id: 'restriction_of_interest',
          label: 'Restriction of Interest',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 1
        },
        {
          id: 'restriction_details',
          label: 'Restriction Details (if yes)',
          type: 'text',
          required: false,
          conditional: { field: 'restriction_of_interest', equals: 'yes' },
          gridColumn: 2
        }
      ]
    },
    // Section 5: Applicable for Refinancing Only (moved from position 3)
    {
      id: 'refinancing_details',
      title: 'Applicable for Refinancing Only',
      description: 'Additional details for refinancing applications',
      fields: [
        {
          id: 'outstanding_balance',
          label: 'Outstanding Loan/Financing Balance (RM)',
          type: 'currency',
          required: false,
          gridColumn: 1
        },
        {
          id: 'buyer_seller_relationship',
          label: 'Relationship Between Buyer & Seller (if applicable)',
          type: 'text',
          required: false,
          gridColumn: 2
        }
      ]
    },
    // Section 6: Outstanding Loan / Financing Commitments (stayed at position 6)
    {
      id: 'other_financing',
      title: 'Outstanding Loan / Financing Commitments',
      description: 'List all existing financial commitments',
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
        }
      ]
    },
    // Section 7: Lawyer & Valuer Information (NEW!)
    {
      id: 'lawyer_valuer',
      title: 'Lawyer & Valuer Information',
      description: 'Legal representative and property valuer details',
      fields: [
        {
          id: 'has_lawyer',
          label: 'Do you have a lawyer?',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        },
        {
          id: 'is_panel_lawyer',
          label: 'Is this a panel lawyer?',
          type: 'radio',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
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
          id: 'law_firm_name',
          label: 'Law Firm Name',
          type: 'text',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'lawyer_contact',
          label: 'Contact Number',
          type: 'tel',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'lawyer_email',
          label: 'Email Address',
          type: 'email',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'lawyer_address',
          label: 'Office Address',
          type: 'textarea',
          required: false,
          conditional: { field: 'has_lawyer', equals: 'yes' },
          gridColumn: 2
        },
        {
          id: 'has_valuer',
          label: 'Do you have a valuer?',
          type: 'radio',
          required: true,
          options: [
            { label: 'Yes', value: 'yes' },
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
          label: 'Valuation Firm',
          type: 'text',
          required: false,
          conditional: { field: 'has_valuer', equals: 'yes' },
          gridColumn: 1
        },
        {
          id: 'valuer_contact',
          label: 'Contact Number',
          type: 'tel',
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
    },
    // Section 8: Consent & Acknowledgement (moved from position 7 to 8)
    {
      id: 'consent_declarations',
      title: 'Consent & Acknowledgement',
      description: 'Required consents and declarations',
      fields: [
        {
          id: 'consent_personal_data',
          label: 'Consent to process personal data',
          type: 'checkbox',
          required: true,
          gridColumn: 2
        },
        {
          id: 'consent_third_party_charges',
          label: 'Consent for 3rd party charges / legal fees',
          type: 'checkbox',
          required: true,
          gridColumn: 2
        },
        {
          id: 'consent_product_disclosure',
          label: 'Have read and understood the Product Disclosure Sheet',
          type: 'checkbox',
          required: true,
          gridColumn: 2
        },
        {
          id: 'interested_ocbc_card',
          label: 'Interest in Applying for OCBC Card',
          type: 'radio',
          required: false,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' }
          ],
          gridColumn: 2
        }
      ]
    }
  ]
}
