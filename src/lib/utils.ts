import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ms-MY').format(num)
}

export function monthsToYearsMonths(months: number): string {
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (years === 0) return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
  if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} yr ${remainingMonths} mo`
}

export function parseToMonths(years: number, months: number): number {
  return (years * 12) + months
}

export function calcMaxTenureMonths(dobString: string): number {
  const dob = new Date(dobString)
  const retirementDate = new Date(dob)
  retirementDate.setFullYear(dob.getFullYear() + 70)
  const now = new Date()
  const diffMs = retirementDate.getTime() - now.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()
}
