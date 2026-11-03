-- 068: Super-Admin-Statistik „Produzentenaccounts“ nach Mitgliedschaften (065).
--
-- Bisher eine Zeile pro Person mit der jeweiligen Rolle, verknüpft über
-- vereine.profile_id / organisationen.profile_id. Seit 065 hat ein Verein mehrere
-- Mitglieder und profile_id wird nicht mehr gepflegt: Hinzugefügte Mitglieder
-- erschienen ohne Vereinsnamen, die Beiträge eines Vereins verteilten sich auf
-- Personen, und Organisationen wurden in der falschen Tabelle gesucht.
--
-- Jetzt:
--   * verein / organisation / gewerbe: eine Zeile pro Verein bzw. Betrieb.
--     Beiträge über posts.org_id (zählt auch Beiträge gelöschter Konten),
--     Abonnenten über den Verein. Vereine ohne Mitglieder erscheinen ebenfalls.
--   * alle anderen Rollen (verwaltung, gemeinderat): wie bisher pro Person.
-- Rückgabeformat unverändert (id, name, posts_7d, posts_30d, subscribers, is_active).

create or replace function public.superadmin_produzentenaccounts(
  p_rolle       text,
  p_gemeinde_id uuid default null
)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with veroeffentlicht as (
    select author_id, org_id, channel::text as channel,
           published_at > now() - interval '7 days'  as in_7d,
           published_at > now() - interval '30 days' as in_30d
      from public.posts
     where status::text = 'published'
       and (p_gemeinde_id is null or gemeinde_id = p_gemeinde_id)
  ),
  ziel_posts as (
    select org_id, count(*) filter (where in_7d) as cnt_7d, count(*) filter (where in_30d) as cnt_30d
      from veroeffentlicht
     where org_id is not null and channel in ('verein', 'gewerbe')
     group by org_id
  ),
  person_posts as (
    select author_id, count(*) filter (where in_7d) as cnt_7d, count(*) filter (where in_30d) as cnt_30d
      from veroeffentlicht
     group by author_id
  ),
  ziele as (
    select v.id, v.verein_name as name, v.created_at,
           (select count(*) from public.verein_abonnements va where va.verein_id = v.id) as subs
      from public.vereine v
     where p_rolle in ('verein', 'organisation')
       and v.typ = p_rolle
       and (p_gemeinde_id is null or v.gemeinde_id = p_gemeinde_id)
    union all
    select o.id, o.name, o.created_at,
           (select count(*) from public.gewerbe_abonnements ga where ga.gewerbe_id = o.id)
      from public.organisationen o
     where p_rolle = 'gewerbe'
       and o.typ::text = 'gewerbe'
       and (p_gemeinde_id is null or o.gemeinde_id = p_gemeinde_id)
  ),
  zeilen as (
    select z.id, z.name, coalesce(zp.cnt_7d, 0) as p7, coalesce(zp.cnt_30d, 0) as p30,
           z.subs::int as subs, z.created_at
      from ziele z
      left join ziel_posts zp on zp.org_id = z.id
    union all
    select p.id, p.display_name, coalesce(pp.cnt_7d, 0), coalesce(pp.cnt_30d, 0),
           null::int, p.created_at
      from public.profiles p
      left join person_posts pp on pp.author_id = p.id
     where p_rolle not in ('verein', 'organisation', 'gewerbe')
       and p.role::text = p_rolle
       and (p_gemeinde_id is null or p.gemeinde_id = p_gemeinde_id)
  )
  select coalesce(json_agg(
    json_build_object(
      'id',          id,
      'name',        coalesce(nullif(trim(coalesce(name, '')), ''), '–'),
      'posts_7d',    p7,
      'posts_30d',   p30,
      'subscribers', subs,
      'is_active',   p30 > 0
    )
    order by p30 desc, created_at
  ), '[]'::json)
  from zeilen
$$;

-- Wie in 010: nur service_role (Super-Admin-Dashboard, Service-Client)
revoke execute on function public.superadmin_produzentenaccounts(text, uuid) from public, anon, authenticated;
grant execute on function public.superadmin_produzentenaccounts(text, uuid) to service_role;
