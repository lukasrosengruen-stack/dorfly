-- Bilder-URLs für Gemeinderäte auf Social Media
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_x         text,
  ADD COLUMN IF NOT EXISTS social_facebook  text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_tiktok    text;
