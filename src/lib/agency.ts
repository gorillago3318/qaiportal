import { createClient } from '@supabase/supabase-js'

export type Agency = {
  id: string
  name: string
  slug: string
  code_prefix: string
  custom_domain: string | null
  logo_url: string | null
  primary_color: string
  accent_color: string
  is_active: boolean
}

const QAI_DEFAULTS: Agency = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'QuantifyAI',
  slug: 'qai',
  code_prefix: 'QAI',
  custom_domain: null,
  logo_url: null,
  primary_color: '#0A1628',
  accent_color: '#C9A84C',
  is_active: true,
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getAgencyBySlug(slug: string): Promise<Agency> {
  try {
    const supabase = getServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('agencies')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    return (data as Agency) || QAI_DEFAULTS
  } catch {
    return QAI_DEFAULTS
  }
}

export async function getAgencyByDomain(domain: string): Promise<Agency> {
  try {
    const supabase = getServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('agencies')
      .select('*')
      .eq('custom_domain', domain)
      .eq('is_active', true)
      .single()
    return (data as Agency) || QAI_DEFAULTS
  } catch {
    return QAI_DEFAULTS
  }
}

export function resolveAgencySlug(host: string): string {
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'qai'
  }
  // subdomain pattern: xxx.quantifyai.me
  const parts = host.split('.')
  if (parts.length >= 3) {
    return parts[0]
  }
  // custom domain — return full host, resolved later
  return host
}
