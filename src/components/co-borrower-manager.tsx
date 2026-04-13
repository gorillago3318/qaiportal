'use client'

import { useState } from 'react'
import { Plus, Trash2, User, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CoBorrowerInfo } from '@/app/agent/cases/new/page'

interface CoBorrowerManagerProps {
  coBorrowers: CoBorrowerInfo[]
  onChange: (coBorrowers: CoBorrowerInfo[]) => void
}

const emptyCoBorrower: CoBorrowerInfo = {
  title: '',
  full_name: '',
  ic_passport: '',
  old_ic: '',
  passport_expiry: '',
  date_of_birth: '',
  gender: '',
  race: '',
  bumiputra: '',
  marital_status: '',
  relationship: '',
  no_of_dependants: '',
  home_address: '',
  post_code: '',
  city: '',
  state: '',
  country: '',
  years_at_address: '',
  correspondence_same_as_home: true,
  correspondence_address: '',
  contact_number: '',
  email: '',
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
}

export function CoBorrowerManager({ coBorrowers, onChange }: CoBorrowerManagerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const addCoBorrower = () => {
    const newCoBorrowers = [...coBorrowers, { ...emptyCoBorrower }]
    onChange(newCoBorrowers)
    setExpandedIndex(newCoBorrowers.length - 1) // Auto-expand the new one
  }

  const removeCoBorrower = (index: number) => {
    const newCoBorrowers = coBorrowers.filter((_, i) => i !== index)
    onChange(newCoBorrowers)
    if (expandedIndex === index) {
      setExpandedIndex(null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const updateCoBorrower = (index: number, field: keyof CoBorrowerInfo, value: any) => {
    const newCoBorrowers = [...coBorrowers]
    newCoBorrowers[index] = { ...newCoBorrowers[index], [field]: value }
    onChange(newCoBorrowers)
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  if (coBorrowers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <User className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium mb-2">No co-borrowers added yet</p>
          <p className="text-sm text-gray-500 mb-4">Add co-borrowers, guarantors, or chargers if applicable</p>
          <Button onClick={addCoBorrower} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Co-Borrower
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#0A1628]">Co-Borrowers ({coBorrowers.length})</h3>
          <p className="text-sm text-gray-600">Manage all co-borrowers, guarantors, and chargers</p>
        </div>
        <Button onClick={addCoBorrower} variant="gold" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Co-Borrower
        </Button>
      </div>

      {/* Co-Borrower Cards */}
      <div className="space-y-3">
        {coBorrowers.map((coBorrower, index) => (
          <Card key={index} className="border-2 border-gray-200 hover:border-[#C9A84C] transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="w-10 h-10 rounded-full bg-[#0A1628] text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {coBorrower.full_name || `Co-Borrower ${index + 1}`}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {coBorrower.ic_passport || 'IC/Passport not provided'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(index)}
                  >
                    {expandedIndex === index ? 'Collapse' : 'Expand'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCoBorrower(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedIndex === index && (
              <CardContent className="space-y-6">
                {/* Personal Details Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                    <User className="w-5 h-5 text-[#C9A84C]" />
                    <h4 className="font-semibold text-[#0A1628]">Personal Details</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <select
                        value={coBorrower.title}
                        onChange={(e) => updateCoBorrower(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select Title</option>
                        <option value="Mr">Mr</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option>
                        <option value="Dr">Dr</option>
                        <option value="Dato'">Dato'</option>
                        <option value="Datin">Datin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={coBorrower.full_name}
                        onChange={(e) => updateCoBorrower(index, 'full_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IC/Passport Number *</label>
                      <input
                        type="text"
                        value={coBorrower.ic_passport}
                        onChange={(e) => updateCoBorrower(index, 'ic_passport', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., 900101-10-1234"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Old IC Number</label>
                      <input
                        type="text"
                        value={coBorrower.old_ic}
                        onChange={(e) => updateCoBorrower(index, 'old_ic', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="If applicable"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={coBorrower.date_of_birth}
                        onChange={(e) => updateCoBorrower(index, 'date_of_birth', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                      <select
                        value={coBorrower.gender}
                        onChange={(e) => updateCoBorrower(index, 'gender', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Race *</label>
                      <select
                        value={coBorrower.race}
                        onChange={(e) => updateCoBorrower(index, 'race', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select Race</option>
                        <option value="malay">Malay</option>
                        <option value="chinese">Chinese</option>
                        <option value="indian">Indian</option>
                        <option value="others">Others</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status *</label>
                      <select
                        value={coBorrower.marital_status}
                        onChange={(e) => updateCoBorrower(index, 'marital_status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select Status</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relationship to Main Applicant *</label>
                      <select
                        value={coBorrower.relationship}
                        onChange={(e) => updateCoBorrower(index, 'relationship', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select Relationship</option>
                        <option value="spouse">Spouse</option>
                        <option value="parent">Parent</option>
                        <option value="child">Child</option>
                        <option value="sibling">Sibling</option>
                        <option value="relative">Relative</option>
                        <option value="business_partner">Business Partner</option>
                        <option value="others">Others</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
                      <input
                        type="tel"
                        value={coBorrower.contact_number}
                        onChange={(e) => updateCoBorrower(index, 'contact_number', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., 012-3456789"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={coBorrower.email}
                        onChange={(e) => updateCoBorrower(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Home Address *</label>
                      <textarea
                        value={coBorrower.home_address}
                        onChange={(e) => updateCoBorrower(index, 'home_address', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="Enter full address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                      <input
                        type="text"
                        value={coBorrower.post_code}
                        onChange={(e) => updateCoBorrower(index, 'post_code', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., 50000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={coBorrower.city}
                        onChange={(e) => updateCoBorrower(index, 'city', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., Kuala Lumpur"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <select
                        value={coBorrower.state}
                        onChange={(e) => updateCoBorrower(index, 'state', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select State</option>
                        <option value="johor">Johor</option>
                        <option value="kedah">Kedah</option>
                        <option value="kelantan">Kelantan</option>
                        <option value="kuala_lumpur">Kuala Lumpur</option>
                        <option value="melaka">Melaka</option>
                        <option value="negeri_sembilan">Negeri Sembilan</option>
                        <option value="pahang">Pahang</option>
                        <option value="penang">Penang</option>
                        <option value="perak">Perak</option>
                        <option value="perlis">Perlis</option>
                        <option value="putrajaya">Putrajaya</option>
                        <option value="sabah">Sabah</option>
                        <option value="sarawak">Sarawak</option>
                        <option value="selangor">Selangor</option>
                        <option value="terengganu">Terengganu</option>
                        <option value="labuan">Labuan</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Employment Details Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                    <Briefcase className="w-5 h-5 text-[#C9A84C]" />
                    <h4 className="font-semibold text-[#0A1628]">Employment Details</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type *</label>
                      <select
                        value={coBorrower.employment_type}
                        onChange={(e) => updateCoBorrower(index, 'employment_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                      >
                        <option value="">Select Type</option>
                        <option value="salaried">Salaried</option>
                        <option value="commission">Commission Earner</option>
                        <option value="self_employed">Self-Employed</option>
                        <option value="retiree">Retiree</option>
                        <option value="others">Others</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income (RM) *</label>
                      <input
                        type="number"
                        value={coBorrower.monthly_income}
                        onChange={(e) => updateCoBorrower(index, 'monthly_income', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., 5000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employer/Business Name *</label>
                      <input
                        type="text"
                        value={coBorrower.employer_name}
                        onChange={(e) => updateCoBorrower(index, 'employer_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="Company or business name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Occupation/Position</label>
                      <input
                        type="text"
                        value={coBorrower.occupation}
                        onChange={(e) => updateCoBorrower(index, 'occupation', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., Manager, Engineer"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nature of Business</label>
                      <input
                        type="text"
                        value={coBorrower.nature_of_business}
                        onChange={(e) => updateCoBorrower(index, 'nature_of_business', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., Manufacturing, Retail, IT Services"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employer Address</label>
                      <textarea
                        value={coBorrower.employer_address}
                        onChange={(e) => updateCoBorrower(index, 'employer_address', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="Office/business address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office Telephone</label>
                      <input
                        type="tel"
                        value={coBorrower.office_tel}
                        onChange={(e) => updateCoBorrower(index, 'office_tel', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                        placeholder="e.g., 03-12345678"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length of Service</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={coBorrower.length_service_years}
                          onChange={(e) => updateCoBorrower(index, 'length_service_years', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          placeholder="Years"
                        />
                        <input
                          type="number"
                          value={coBorrower.length_service_months}
                          onChange={(e) => updateCoBorrower(index, 'length_service_months', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          placeholder="Months"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
