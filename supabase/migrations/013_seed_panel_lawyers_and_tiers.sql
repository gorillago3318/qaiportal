-- Migration 013: Seed authoritative panel lawyers and commission tier config
-- Run in Supabase SQL Editor
-- See: docs/core/constitution.md for business rules

-- ══════════════════════════════════════════════════════
-- Panel Lawyers (DEC-017)
-- Only Low, Wong and Zahrita and Yong & Rajah are panel.
-- lawyers table has no unique constraint on (name, agency_id),
-- so we use WHERE NOT EXISTS to avoid duplicates.
-- ══════════════════════════════════════════════════════

-- First, mark ALL existing lawyers as non-panel (reset)
UPDATE lawyers
  SET is_panel = FALSE
  WHERE agency_id = '00000000-0000-0000-0000-000000000001';

-- Insert Low, Wong and Zahrita if not already there
INSERT INTO lawyers (name, firm, is_panel, is_active, agency_id)
SELECT
  'Low, Wong and Zahrita',
  'Low, Wong and Zahrita',
  TRUE,
  TRUE,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
  SELECT 1 FROM lawyers
  WHERE name = 'Low, Wong and Zahrita'
    AND agency_id = '00000000-0000-0000-0000-000000000001'
);

-- If it already exists, mark it as panel
UPDATE lawyers
  SET is_panel = TRUE, is_active = TRUE
  WHERE name = 'Low, Wong and Zahrita'
    AND agency_id = '00000000-0000-0000-0000-000000000001';

-- Insert Yong & Rajah if not already there
INSERT INTO lawyers (name, firm, is_panel, is_active, agency_id)
SELECT
  'Yong & Rajah',
  'Yong & Rajah',
  TRUE,
  TRUE,
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
  SELECT 1 FROM lawyers
  WHERE name = 'Yong & Rajah'
    AND agency_id = '00000000-0000-0000-0000-000000000001'
);

-- If it already exists, mark it as panel
UPDATE lawyers
  SET is_panel = TRUE, is_active = TRUE
  WHERE name = 'Yong & Rajah'
    AND agency_id = '00000000-0000-0000-0000-000000000001';

-- ══════════════════════════════════════════════════════
-- Commission Tier Config for QAI (DEC-005)
-- Unique constraint: (agency_id, tier) — ON CONFLICT is safe here.
-- ══════════════════════════════════════════════════════

INSERT INTO commission_tier_config (tier, percentage, agency_id)
VALUES
  ('agent',           70.0,   '00000000-0000-0000-0000-000000000001'),
  ('senior_agent',    80.0,   '00000000-0000-0000-0000-000000000001'),
  ('unit_manager',    87.5,   '00000000-0000-0000-0000-000000000001'),
  ('agency_manager',  92.5,   '00000000-0000-0000-0000-000000000001')
ON CONFLICT (agency_id, tier) DO UPDATE
  SET percentage = EXCLUDED.percentage;

-- ══════════════════════════════════════════════════════
-- Verify results
-- ══════════════════════════════════════════════════════
SELECT name, firm, is_panel, is_active FROM lawyers
  WHERE agency_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY is_panel DESC, name;

SELECT tier, percentage FROM commission_tier_config
  WHERE agency_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY percentage;
