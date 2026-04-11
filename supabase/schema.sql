-- LovMedSpa Review Funnel — Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CLIENTS TABLE
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
  monthly_review_limit INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REVIEWS TABLE
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

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS reviews_client_id_idx ON reviews(client_id);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_review_type_idx ON reviews(review_type);

-- ============================================================
-- QR CODES TABLE
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

-- CLIENTS: Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Public can read active clients (needed to render the funnel)
CREATE POLICY "Public reads active clients"
  ON clients FOR SELECT
  USING (is_active = true);

-- Only authenticated users (admins) can insert/update/delete clients
CREATE POLICY "Admin manages clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

-- REVIEWS: Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert a review — this is the public submission
CREATE POLICY "Anyone can submit reviews"
  ON reviews FOR INSERT
  WITH CHECK (true);

-- Only authenticated users can read reviews
CREATE POLICY "Admin reads reviews"
  ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only authenticated users can update reviews (e.g., mark copied_to_clipboard)
CREATE POLICY "Admin updates reviews"
  ON reviews FOR UPDATE
  USING (auth.role() = 'authenticated');

-- QR CODES: Enable RLS
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Public can read active QR codes (needed for redirect)
CREATE POLICY "Public reads active QR codes"
  ON qr_codes FOR SELECT
  USING (is_active = true);

-- Only authenticated users can manage QR codes
CREATE POLICY "Admin manages QR codes"
  ON qr_codes FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- RPC: Increment QR scan count
-- Called from the /q/[shortCode] redirect route
-- ============================================================
CREATE OR REPLACE FUNCTION increment_qr_scan(qr_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = qr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
