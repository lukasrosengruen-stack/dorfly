-- Fix: Super-Admin-Dashboard zählte Posts über die falsche Spalte.
--
-- Die Statistik-Funktionen filterten Posts mit `sichtbarkeit::text = 'published'`.
-- `sichtbarkeit` ist jedoch die Zielgruppe eines Posts ('alle' | 'abonnenten' | NULL),
-- NICHT der Veröffentlichungs-Status. Der Publish-Status liegt in der Spalte `status`
-- (Enum post_status: 'pending' | 'published' | 'rejected') — vgl. Feed-Query in
-- src/app/(app)/feed/page.tsx (.eq('status', 'published')).
--
-- Folge: die Filter matchten nie und alle Post-Zahlen im Dashboard waren 0.
-- Diese Migration definiert die drei betroffenen Funktionen mit dem korrekten Filter neu.

-- ─── Rollen-Statistiken ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION superadmin_rollen_stats(p_gemeinde_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH post_counts AS (
    SELECT
      author_id,
      COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days')  AS cnt_7d,
      COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '30 days') AS cnt_30d
    FROM public.posts
    WHERE status::text = 'published'
      AND (p_gemeinde_id IS NULL OR gemeinde_id = p_gemeinde_id)
    GROUP BY author_id
  )
  SELECT COALESCE(json_agg(stats), '[]'::json)
  FROM (
    SELECT
      p.role::text                                                           AS role,
      COUNT(DISTINCT p.id)                                                   AS account_count,
      COALESCE(SUM(pc.cnt_7d),  0)                                          AS posts_7d,
      COALESCE(SUM(pc.cnt_30d), 0)                                          AS posts_30d,
      COUNT(DISTINCT CASE WHEN COALESCE(pc.cnt_30d, 0) > 0 THEN p.id END)  AS active_30d
    FROM public.profiles p
    LEFT JOIN post_counts pc ON pc.author_id = p.id
    WHERE p.role::text IN ('verwaltung', 'verein', 'organisation', 'gewerbe', 'gemeinderat')
      AND (p_gemeinde_id IS NULL OR p.gemeinde_id = p_gemeinde_id)
    GROUP BY p.role
  ) stats;
$$;

-- ─── Posts-Statistiken ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION superadmin_posts_stats(p_gemeinde_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'posts_7d',  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days'),
    'posts_30d', COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '30 days')
  )
  FROM public.posts
  WHERE status::text = 'published'
    AND (p_gemeinde_id IS NULL OR gemeinde_id = p_gemeinde_id);
$$;

-- ─── Produzenten-Accounts ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION superadmin_produzentenaccounts(
  p_rolle       text,
  p_gemeinde_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH post_counts AS (
    SELECT
      author_id,
      COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days')  AS cnt_7d,
      COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '30 days') AS cnt_30d
    FROM public.posts
    WHERE status::text = 'published'
      AND (p_gemeinde_id IS NULL OR gemeinde_id = p_gemeinde_id)
    GROUP BY author_id
  ),
  verein_data AS (
    SELECT v.profile_id,
           v.verein_name,
           COUNT(va.id) AS sub_count
    FROM public.vereine v
    LEFT JOIN public.verein_abonnements va ON va.verein_id = v.id
    WHERE (p_gemeinde_id IS NULL OR v.gemeinde_id = p_gemeinde_id)
    GROUP BY v.profile_id, v.verein_name
  ),
  gewerbe_data AS (
    SELECT o.profile_id,
           o.name AS org_name,
           COUNT(ga.id) AS sub_count
    FROM public.organisationen o
    LEFT JOIN public.gewerbe_abonnements ga ON ga.gewerbe_id = o.id
    WHERE o.typ::text = 'gewerbe'
      AND (p_gemeinde_id IS NULL OR o.gemeinde_id = p_gemeinde_id)
    GROUP BY o.profile_id, o.name
  ),
  org_data AS (
    SELECT DISTINCT ON (o.profile_id) o.profile_id, o.name AS org_name
    FROM public.organisationen o
    WHERE o.typ::text != 'gewerbe'
      AND (p_gemeinde_id IS NULL OR o.gemeinde_id = p_gemeinde_id)
    ORDER BY o.profile_id, o.created_at
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'id',          p.id,
      'name',        COALESCE(
                       NULLIF(TRIM(COALESCE(vd.verein_name, '')), ''),
                       NULLIF(TRIM(COALESCE(gd.org_name,    '')), ''),
                       NULLIF(TRIM(COALESCE(od.org_name,    '')), ''),
                       NULLIF(TRIM(COALESCE(p.display_name, '')), ''),
                       '–'
                     ),
      'posts_7d',    COALESCE(pc.cnt_7d,  0),
      'posts_30d',   COALESCE(pc.cnt_30d, 0),
      'subscribers', CASE
                       WHEN p_rolle = 'verein'  THEN COALESCE(vd.sub_count, 0)
                       WHEN p_rolle = 'gewerbe' THEN COALESCE(gd.sub_count, 0)
                       ELSE NULL
                     END,
      'is_active',   COALESCE(pc.cnt_30d, 0) > 0
    )
    ORDER BY COALESCE(pc.cnt_30d, 0) DESC, p.created_at
  ), '[]'::json)
  FROM public.profiles p
  LEFT JOIN post_counts  pc ON pc.author_id  = p.id
  LEFT JOIN verein_data  vd ON vd.profile_id = p.id
  LEFT JOIN gewerbe_data gd ON gd.profile_id = p.id
  LEFT JOIN org_data     od ON od.profile_id = p.id
  WHERE p.role::text = p_rolle
    AND (p_gemeinde_id IS NULL OR p.gemeinde_id = p_gemeinde_id);
$$;
