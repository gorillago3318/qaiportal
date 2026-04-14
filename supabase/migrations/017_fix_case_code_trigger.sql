-- Migration 017: Fix case_code generation trigger
-- Problem: COUNT(*)+1 causes duplicates when cases are deleted (gaps in sequence).
-- Fix: Use MAX of existing numeric suffixes so we always produce a number higher than any existing code.

CREATE OR REPLACE FUNCTION generate_case_code()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_seq  INTEGER;
  v_code TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Use MAX of existing numeric suffixes so gaps from deletions don't cause duplicates
  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(case_code, '-', 3) AS INTEGER)), 0
  ) + 1 INTO v_seq
  FROM cases
  WHERE case_code LIKE 'QAI-' || v_year || '-%'
    AND SPLIT_PART(case_code, '-', 3) ~ '^[0-9]+$';

  v_code := 'QAI-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  NEW.case_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
