-- 066: Abschluss der Mitgliedschaften (065). NACH dem Code-Deploy einspielen.
--
-- 1. Nachzügler: Vereine/Gewerbe, die alter Code zwischen 065 und Deploy angelegt
--    hat, haben profile_id, aber keine Mitglieder. Übernommen wird nur, wer noch die
--    passende Rolle hat — bewusst entfernte Personen sind wieder 'buerger'.
-- 2. Alle Schreibwege laufen jetzt über API-Routen mit service_role. Direkte
--    Schreibrechte für authenticated entfallen (vorher per RLS auf profile_id).

-- 0. Aufräumen: Alter Code hat zwischen 065 und Deploy Rollen zurückgesetzt oder
--    Vereine übertragen, ohne die Mitgliedschaften zu kennen. Mitglieder, deren
--    Profilrolle nicht mehr zum Ziel passt (Verein/Organisation: vereine.typ,
--    Gewerbe: 'gewerbe'), verlieren die Mitgliedschaft. Danach holen die Inserts
--    unten die aktuellen Inhaber nach.
delete from public.mitgliedschaften m
 using public.profiles p
 where p.id = m.profile_id
   and p.role::text <> coalesce((select v.typ from public.vereine v where v.id = m.verein_id), 'gewerbe');

insert into public.mitgliedschaften (profile_id, verein_id, rolle)
select v.profile_id, v.id, 'verwalter'
  from public.vereine v
  join public.profiles p on p.id = v.profile_id
 where p.role::text = v.typ
   and not exists (select 1 from public.mitgliedschaften m where m.verein_id = v.id)
on conflict (profile_id) do nothing;

insert into public.mitgliedschaften (profile_id, organisation_id, rolle)
select o.profile_id, o.id, 'verwalter'
  from public.organisationen o
  join public.profiles p on p.id = o.profile_id
 where p.role::text = 'gewerbe'
   and not exists (select 1 from public.mitgliedschaften m where m.organisation_id = o.id)
on conflict (profile_id) do nothing;

drop policy if exists "vereine_insert_own" on public.vereine;
drop policy if exists "vereine_update_own" on public.vereine;
drop policy if exists "vereine_delete_own" on public.vereine;
drop policy if exists "Gewerbe anlegen" on public.organisationen;
drop policy if exists "Gewerbe bearbeiten" on public.organisationen;

revoke insert, update, delete on public.vereine from authenticated;
revoke insert, update, delete on public.organisationen from authenticated;
