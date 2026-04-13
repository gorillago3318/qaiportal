-- Migration to add interest_rate column to banks table
ALTER TABLE banks ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2);
