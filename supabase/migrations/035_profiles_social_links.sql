-- Social-Media-Benutzernamen für Gemeinderäte (X, Facebook, Instagram, TikTok)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_x         text,
  ADD COLUMN IF NOT EXISTS social_facebook  text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_tiktok    text;

-- Explicit grant per project convention (014_profiles_phone_nullable pattern)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
