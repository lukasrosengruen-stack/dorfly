-- 041_fix_posts_dwd_id_unique.sql
-- posts_dwd_id_unique war global statt pro Gemeinde -- verhinderte,
-- dass zwei Gemeinden mit derselben Warncell-ID dieselbe DWD-Warnung erhalten

DROP INDEX IF EXISTS public.posts_dwd_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS posts_gemeinde_dwd_id_unique
  ON public.posts(gemeinde_id, dwd_id)
  WHERE dwd_id IS NOT NULL;
