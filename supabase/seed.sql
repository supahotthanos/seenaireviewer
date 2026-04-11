-- LovMedSpa Review Funnel — Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor
-- Update REPLACE_WITH_REAL_* placeholders before running in production

INSERT INTO clients (
  slug,
  business_name,
  location_address,
  location_city,
  google_place_id,
  brand_color_primary,
  brand_color_secondary,
  services,
  team_members,
  notification_email,
  notification_phone,
  is_active,
  monthly_review_limit
) VALUES (
  'lovmedspa-brooklyn',
  'LovMedSpa',
  '1 Boerum Pl Suite 252, Brooklyn, NY 11201',
  'Brooklyn, NY',
  'REPLACE_WITH_REAL_GOOGLE_PLACE_ID',
  '#c9a87c',
  '#a01b1b',
  '["Botox", "Filler", "Microneedling", "HydraFacial", "Laser Hair Removal", "Chemical Peel", "Kybella", "PRP", "IV Therapy", "Lashes"]'::jsonb,
  '["Dr. Lov", "Provider 2", "Provider 3"]'::jsonb,
  'owner@lovmedspa.com',
  NULL,
  true,
  200
)
ON CONFLICT (slug) DO NOTHING;

-- Insert a test QR code for development
INSERT INTO qr_codes (
  client_id,
  label,
  short_code,
  scan_count,
  is_active
)
SELECT
  id,
  'Front Desk',
  'lms-bk-01',
  0,
  true
FROM clients
WHERE slug = 'lovmedspa-brooklyn'
ON CONFLICT (short_code) DO NOTHING;
