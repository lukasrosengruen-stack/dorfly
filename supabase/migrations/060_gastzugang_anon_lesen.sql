-- 060: Gastzugang — anon darf oeffentliche, nicht-account-basierte Inhalte lesen.
-- Kontext: App-Store 5.1.1(v). Alles bleibt fuer anon strikt lesend (nur SELECT).
-- Die App filtert jede Query serverseitig per gemeinde_id (aus dem Host-Header),
-- daher sind die anon-Policies bewusst using(true) bzw. auf oeffentliche Zeilen beschraenkt.

-- ── vereine ───────────────────────────────────────────────────────────────────
create policy "vereine_anon_lesen" on public.vereine
  for select to anon using (true);
grant select on public.vereine to anon;

-- ── verein_kategorien ─────────────────────────────────────────────────────────
create policy "verein_kategorien_anon_lesen" on public.verein_kategorien
  for select to anon using (true);
grant select on public.verein_kategorien to anon;

-- ── organisationen ────────────────────────────────────────────────────────────
-- anon nur Gewerbe (das einzige gast-sichtbare Verzeichnis), keine sonstigen Orgs.
create policy "organisationen_anon_lesen" on public.organisationen
  for select to anon using (typ = 'gewerbe');
grant select on public.organisationen to anon;

-- ── abfalltermine ─────────────────────────────────────────────────────────────
grant select on public.abfalltermine to anon;

-- ── abfallkalender_einstellungen ──────────────────────────────────────────────
grant select on public.abfallkalender_einstellungen to anon;

-- ── post_termine ──────────────────────────────────────────────────────────────
-- Kein Eintrag noetig: 053 vergibt bereits `grant select ... to anon` und hat eine
-- Policy `using(true)` fuer alle Rollen. Hier nur zur Dokumentation vermerkt.

-- ── profiles_public (View) ────────────────────────────────────────────────────
-- Laeuft als Owner (security_invoker=off) und filtert per current_gemeinde_id(),
-- das fuer anon NULL ist → wuerde 0 Zeilen liefern. WHERE so anpassen, dass anon
-- (current_gemeinde_id() IS NULL) die Nicht-Buerger-Profile sieht; authenticated
-- behaelt den Gemeinde-Filter unveraendert.
--
-- Datenschutz: Fuer anon (current_gemeinde_id() IS NULL) werden die sensiblen
-- Felder (kontakt_email, ueber_mich, fraktion, social_*) auf NULL maskiert, damit
-- sie nicht plattformweit ueber die anon-API abgegriffen werden koennen
-- (E-Mail-Harvesting/DSGVO-Datenminimierung). Der Gast-Feed braucht nur
-- display_name/verein_name/role/avatar_url fuer die Autoren-Anzeige. Eingeloggte
-- Nutzer erhalten unveraendert die vollen Werte. Spalten-/Typliste identisch zu 041.
create or replace view public.profiles_public
with (security_invoker = off)
as
  select
    id, gemeinde_id, display_name, verein_name, role, avatar_url,
    case when public.current_gemeinde_id() is null then null else fraktion end          as fraktion,
    case when public.current_gemeinde_id() is null then null else ueber_mich end        as ueber_mich,
    case when public.current_gemeinde_id() is null then null else kontakt_email end     as kontakt_email,
    case when public.current_gemeinde_id() is null then null else social_x end          as social_x,
    case when public.current_gemeinde_id() is null then null else social_facebook end   as social_facebook,
    case when public.current_gemeinde_id() is null then null else social_instagram end  as social_instagram,
    case when public.current_gemeinde_id() is null then null else social_tiktok end     as social_tiktok
  from public.profiles
  where role <> 'buerger'::user_role
    and (
      public.current_gemeinde_id() is null
      or gemeinde_id = public.current_gemeinde_id()
    );

grant select on public.profiles_public to anon;
