// Maps a normalized client profile (from `clients` table) to bank-specific
// form field keys. Used to autofill a new bank-form when the agent has
// previously created cases for the same client (identified by IC).
//
// Each bank form uses different field keys (e.g. HLB `client_phone` vs
// OCBC `contact_numbers`). This layer keeps a single source of truth —
// the `clients` row — and projects it into whichever config is active.

export type ClientProfile = {
  full_name: string | null
  ic_number: string | null
  phone: string | null
  email: string | null
  date_of_birth: string | null // YYYY-MM-DD
  gender: string | null
  marital_status: string | null
  address: string | null
  employer: string | null
  monthly_income: number | null
}

// Produce a partial form-data object for the given bank's field keys.
// Only overrides EMPTY values — never clobbers what the agent has typed.
export function projectClientToBankForm(
  profile: ClientProfile,
  bankId: string,
  currentFormData: Record<string, unknown>
): Record<string, unknown> {
  const common: Record<string, unknown> = {
    client_name: profile.full_name,
    client_ic: profile.ic_number,
    client_dob: profile.date_of_birth,
    client_email: profile.email,
    gender: profile.gender,
    marital_status: profile.marital_status,
    home_address: profile.address,
    monthly_income: profile.monthly_income,
    employer_name: profile.employer,
  }

  const bankSpecific: Record<string, unknown> =
    bankId === 'hong_leong_bank' || bankId === 'hlb'
      ? {
          client_phone: profile.phone,
        }
      : bankId === 'ocbc'
      ? {
          contact_numbers: profile.phone,
        }
      : {
          // Generic fallback — use both keys so either renderer picks it up
          client_phone: profile.phone,
          contact_numbers: profile.phone,
        }

  const patch: Record<string, unknown> = { ...common, ...bankSpecific }

  // Only fill empty fields — never overwrite existing input
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') continue
    const current = currentFormData[key]
    if (current === undefined || current === null || current === '') {
      result[key] = value
    }
  }
  return result
}
