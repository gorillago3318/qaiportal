-- Panel lawyer default office address. Stored on lawyer so bank forms can auto-fill.
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS address TEXT;
