-- Migration 018: Full portal reset — wipe all calculations, cases, commissions, clients
-- Run this in Supabase SQL Editor to start completely fresh.

-- Order matters: child tables first to avoid FK violations

-- 1. Commissions (references cases)
DELETE FROM commissions;

-- 2. Case history / comments / documents (children of cases)
DELETE FROM case_status_history;
DELETE FROM case_comments;
DELETE FROM case_documents;

-- 3. Cases
DELETE FROM cases;

-- 4. Clients
DELETE FROM clients;

-- 5. Calculations
DELETE FROM calculations;

-- Reset sequences so case codes start from 0001 again (optional)
-- The trigger uses MAX() so it will naturally restart at 0001 after clearing.
