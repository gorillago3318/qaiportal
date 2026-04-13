import { BankFormConfig } from './types'
import { hlbConfig } from './hlb'
import { ocbcConfig } from './ocbc'

// Export all bank configurations
export const bankFormConfigs: Record<string, BankFormConfig> = {
  hong_leong_bank: hlbConfig,
  ocbc: ocbcConfig,
}

// Helper function to get config by bank ID or name
export function getBankFormConfig(bankIdentifier: string): BankFormConfig | undefined {
  // Try direct match first
  if (bankFormConfigs[bankIdentifier]) {
    return bankFormConfigs[bankIdentifier]
  }
  
  // Try case-insensitive match on bank name
  const lowerIdentifier = bankIdentifier.toLowerCase()
  return Object.values(bankFormConfigs).find(
    config => config.bankName.toLowerCase() === lowerIdentifier ||
              config.bankId.toLowerCase() === lowerIdentifier
  )
}

// Get list of supported banks
export function getSupportedBanks(): Array<{ id: string; name: string }> {
  return Object.values(bankFormConfigs).map(config => ({
    id: config.bankId,
    name: config.bankName
  }))
}

// Export types for convenience
export * from './types'
