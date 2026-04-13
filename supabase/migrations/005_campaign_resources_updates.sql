-- ============================================================
-- 005_campaign_resources_updates.sql
-- Add Campaign tracking targets and Resource Folders
-- ============================================================

-- 1. CAMPAIGN TARGETS
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_type TEXT CHECK (target_type IN ('volume', 'cases'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_bank_id UUID REFERENCES banks(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_requires_panel_lawyer BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_start_date TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_end_date TIMESTAMPTZ;

-- Allow cases to track if they used a panel lawyer (so they count towards campaigns that require it)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS used_panel_lawyer BOOLEAN DEFAULT false;


-- 2. RESOURCE FOLDERS
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_folder BOOLEAN DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES resources(id) ON DELETE CASCADE;

-- Folders don't have file_url, file_name, file_type
ALTER TABLE resources ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE resources ALTER COLUMN file_name DROP NOT NULL;
