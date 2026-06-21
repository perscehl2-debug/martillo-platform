-- ============================================================
-- MARTILLO — Database Schema
-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────
-- Extends Supabase auth.users with role and display info
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── AUCTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auctions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('auto', 'vivienda')),
  title         TEXT NOT NULL,
  description   TEXT,
  base_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_urls    TEXT[] DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','scheduled','live','ended','sold','cancelled')),
  ends_at       TIMESTAMPTZ NOT NULL,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BIDS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bids (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auction_id  UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update current_price on new bid
CREATE OR REPLACE FUNCTION public.update_auction_price()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.auctions
  SET current_price = NEW.amount
  WHERE id = NEW.auction_id AND NEW.amount > current_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_bid ON public.bids;
CREATE TRIGGER on_new_bid
  AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.update_auction_price();

-- ─── RLS POLICIES ───────────────────────────────────────────
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids      ENABLE ROW LEVEL SECURITY;

-- PROFILES: users see own profile, admins see all
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- AUCTIONS: public read of live auctions, admin writes
CREATE POLICY "Public can view live auctions"
  ON public.auctions FOR SELECT
  USING (status = 'live');

CREATE POLICY "Admins can view all auctions"
  ON public.auctions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can insert auctions"
  ON public.auctions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update auctions"
  ON public.auctions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can delete auctions"
  ON public.auctions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- BIDS: authenticated users can bid on live auctions
CREATE POLICY "Authenticated users can view bids"
  ON public.bids FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create bids"
  ON public.bids FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.auctions WHERE id = auction_id AND status = 'live')
  );

-- ─── STORAGE BUCKET ─────────────────────────────────────────
-- Run separately in Supabase Dashboard > Storage > New Bucket
-- Name: "auction-images", Public: true
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction-images', 'auction-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read auction images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'auction-images');

CREATE POLICY "Admins can upload auction images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'auction-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── SAMPLE DATA (optional — remove in production) ──────────
INSERT INTO public.auctions (type, title, description, base_price, current_price, status, ends_at, image_urls) VALUES
('auto', 'Ferrari 458 Italia 2013', 'Spider V8 4.5L, 570 CV, 23.000 km. Color Rosso Corsa. Impecable estado, todos los servicios al día.', 180000000, 180000000, 'live', NOW() + INTERVAL '3 days', ARRAY['https://images.unsplash.com/photo-1617788738832-27c0a3d9f2d1?w=800']),
('auto', 'Porsche 911 Turbo S 2022', 'Carrera PDK 3.8L biturbo, 650 CV. Color GT Silver. 8.500 km, garantía de fábrica vigente.', 290000000, 295000000, 'live', NOW() + INTERVAL '5 days', ARRAY['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800']),
('vivienda', 'Casa Las Condes — 4D/3B/280m²', 'Casa moderna con jardín, piscina y quincho. Sector privilegiado, colegios y comercio a pasos.', 350000000, 352000000, 'live', NOW() + INTERVAL '7 days', ARRAY['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800']),
('vivienda', 'Departamento Vitacura — 2D/2B/95m²', 'Piso 12, vista panorámica. Edificio con concierge 24h, piscina y gimnasio. Entrega inmediata.', 185000000, 185000000, 'live', NOW() + INTERVAL '4 days', ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'])
ON CONFLICT DO NOTHING;

-- ─── CREATE ADMIN USER ──────────────────────────────────────
-- STEP 1: Register via the app UI with your email/password
-- STEP 2: Get your user UUID from Supabase Dashboard > Auth > Users
-- STEP 3: Run this query replacing <YOUR_USER_UUID>:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = '<YOUR_USER_UUID>';
--
-- That's it — you now have admin access to /admin
