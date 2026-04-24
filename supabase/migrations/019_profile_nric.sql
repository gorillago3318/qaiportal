-- Add NRIC number to profiles for compliance & payouts.
-- Safe to run multiple times.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nric_number TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_nric_number ON profiles(nric_number) WHERE nric_number IS NOT NULL;
