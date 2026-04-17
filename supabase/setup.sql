-- ============================================================
-- SeenAI Review Funnel — One-shot database setup
-- ============================================================
-- Safe to run multiple times. Run this ONCE in Supabase SQL Editor
-- after creating your project. That's it.
--
-- Supabase dashboard → SQL Editor → New query → paste this file → Run.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  location_address TEXT,
  location_city TEXT NOT NULL,
  google_place_id TEXT NOT NULL,
  logo_url TEXT,
  brand_color_primary TEXT DEFAULT '#c9a87c',
  brand_color_secondary TEXT DEFAULT '#a01b1b',
  services JSONB NOT NULL DEFAULT '[]',
  team_members JSONB NOT NULL DEFAULT '[]',
  notification_email TEXT NOT NULL,
  notification_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  monthly_review_limit INTEGER DEFAULT 1000,
  daily_ai_limit INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns for installs that pre-date them (idempotent)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS daily_ai_limit INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color_primary TEXT DEFAULT '#c9a87c',
  ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT DEFAULT '#a01b1b';

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  service_selected TEXT,
  team_member_selected TEXT,
  original_comments TEXT,
  generated_review TEXT,
  review_type TEXT NOT NULL CHECK (review_type IN ('positive', 'negative')),
  copied_to_clipboard BOOLEAN DEFAULT false,
  redirected_to_google BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'sms', 'email', 'web')),
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_client_id_idx ON reviews(client_id);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_review_type_idx ON reviews(review_type);

-- ============================================================
-- QR CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT,
  short_code TEXT UNIQUE NOT NULL,
  scan_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_codes_short_code_idx ON qr_codes(short_code);
CREATE INDEX IF NOT EXISTS qr_codes_client_id_idx ON qr_codes(client_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Drop old policies then recreate (so this file is safely re-runnable)
DROP POLICY IF EXISTS "Public reads active clients" ON clients;
DROP POLICY IF EXISTS "Admin manages clients" ON clients;
DROP POLICY IF EXISTS "Anyone can submit reviews" ON reviews;
DROP POLICY IF EXISTS "Admin reads reviews" ON reviews;
DROP POLICY IF EXISTS "Admin updates reviews" ON reviews;
DROP POLICY IF EXISTS "Public reads active QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Admin manages QR codes" ON qr_codes;

-- Public can read active clients (funnel page needs this)
CREATE POLICY "Public reads active clients"
  ON clients FOR SELECT
  USING (is_active = true);

-- Authenticated role can manage clients. The server routes use the
-- service-role key, which bypasses RLS entirely — this policy only
-- applies if you later add a Supabase Auth dashboard.
CREATE POLICY "Admin manages clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

-- Anyone (anon) can submit a review — public funnel
CREATE POLICY "Anyone can submit reviews"
  ON reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin reads reviews"
  ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin updates reviews"
  ON reviews FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Public can read active QR codes (redirect route)
CREATE POLICY "Public reads active QR codes"
  ON qr_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin manages QR codes"
  ON qr_codes FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- RPC: increment QR scan count (called from /q/[shortCode])
-- ============================================================
CREATE OR REPLACE FUNCTION increment_qr_scan(qr_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = qr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Done. Next: open /admin?key=YOUR_ADMIN_SECRET → + New Location
-- ============================================================
