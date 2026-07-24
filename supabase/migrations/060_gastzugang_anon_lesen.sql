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
-- (current_gemeinde_id() IS NULL) alle Nicht-Buerger-Profile sieht; authenticated
-- behaelt den Gemeinde-Filter unveraendert. Spaltenliste identisch zu 041.
create or replace view public.profiles_public
with (security_invoker = off)
as
  select
    id, gemeinde_id, display_name, verein_name, role, avatar_url,
    fraktion, ueber_mich, kontakt_email,
    social_x, social_facebook, social_instagram, social_tiktok
  from public.profiles
  where role <> 'buerger'::user_role
    and (
      public.current_gemeinde_id() is null
      or gemeinde_id = public.current_gemeinde_id()
    );

grant select on public.profiles_public to anon;
