-- ============================================================
-- 004_features.sql
-- Resources, Campaigns, and CMS tables
-- ============================================================

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  file_url   TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  file_type  TEXT,
  file_size  BIGINT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  agency_id  UUID REFERENCES agencies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency_members_view_resources" ON resources FOR SELECT
  USING (agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "admin_manage_resources" ON resources FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin'));

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  image_url    TEXT,
  target_roles TEXT[] DEFAULT ARRAY['agent','senior_agent','unit_manager','agency_manager'],
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles(id),
  agency_id    UUID REFERENCES agencies(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency_members_view_campaigns" ON campaigns FOR SELECT
  USING (
    is_published = true
    AND (expires_at IS NULL OR expires_at > now())
    AND agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "admin_manage_campaigns" ON campaigns FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin'));

-- Campaign reads (tracking)
CREATE TABLE IF NOT EXISTS campaign_reads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);
ALTER TABLE campaign_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_manage_own_reads" ON campaign_reads FOR ALL USING (user_id = auth.uid());

-- CMS content (key-value store for website sections)
CREATE TABLE IF NOT EXISTS cms_content (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  agency_id  UUID REFERENCES agencies(id),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE cms_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_cms" ON cms_content FOR SELECT USING (true);
CREATE POLICY "admin_write_cms" ON cms_content FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin'));

-- Seed default CMS content
INSERT INTO cms_content (key, value) VALUES
('hero', '{
  "headline": "Refinance Smarter. Save More.",
  "subheadline": "Malaysia''s most powerful mortgage refinance calculator. Free, instant, and accurate.",
  "cta_text": "Calculate Now",
  "cta_url": "/calculate"
}'::jsonb),
('about', '{
  "title": "About QuantifyAI",
  "body": "We help Malaysians make smarter mortgage decisions through AI-powered calculations and expert consultation.",
  "stats": [
    {"label": "Calculations Done", "value": "10,000+"},
    {"label": "Money Saved", "value": "RM 50M+"},
    {"label": "Happy Clients", "value": "5,000+"}
  ]
}'::jsonb),
('contact', '{
  "email": "hello@quantifyai.me",
  "phone": "+60 3-1234 5678",
  "whatsapp": "+60 12-345 6789",
  "address": "Kuala Lumpur, Malaysia"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create resources storage bucket policy (run manually in Supabase dashboard)
-- Bucket: resources (public: false)
