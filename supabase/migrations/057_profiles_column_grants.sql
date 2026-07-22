-- SICHERHEIT: Selbst-Rollen-Escalation & Mandanten-Übernahme über profiles schließen.
--
-- Problem: authenticated hatte tabellenweites INSERT/UPDATE auf public.profiles.
-- Die RLS-Policy "Eigenes Profil bearbeiten" (001) prüft nur `id = auth.uid()` ohne
-- WITH CHECK und ohne Spaltenbeschränkung. Da Supabase PostgREST direkt erreichbar
-- ist, konnte jeder eingeloggte Nutzer per
--   PATCH /rest/v1/profiles?id=eq.<uid>  { "role": "super_admin", "gemeinde_id": "<fremd>" }
-- an der App-Logik vorbei seine eigene Rolle und Gemeinde überschreiben — also sich
-- selbst zum super_admin machen und einen fremden Mandanten übernehmen. Der gleiche
-- Weg existierte über INSERT (Policy `with check (id = auth.uid())`) für Nutzer ohne
-- bestehendes Profil.
--
-- Fix: authenticated bekommt nur noch spaltenweise UPDATE-Rechte auf die Felder, die
-- die Profil-Bearbeitung tatsächlich schreibt. role, gemeinde_id, id, email, phone,
-- phone_verified sowie die Consent-Nachweise (terms_*, age_confirmed_at) sind damit
-- für authenticated nicht mehr schreibbar — sie werden ausschließlich serverseitig
-- über service_role gesetzt (profilAnlegen, /api/verwaltung/nutzer/rolle).
-- INSERT auf profiles erfolgt ausschließlich via service_role (profil-anlegen.ts).
--
-- service_role behält volle Rechte (056) — Rollenvergabe/Registrierung laufen darüber.

revoke insert, update on public.profiles from authenticated;

-- Nur selbst-editierbare Profilfelder (Profil-Bearbeitung, Gemeinderats-/Vereinsprofil).
-- Bewusst NICHT enthalten: id, role, gemeinde_id, email, phone, phone_verified,
-- created_at, updated_at, terms_accepted_at, terms_version, age_confirmed_at.
grant update (
  display_name,
  vorname,
  nachname,
  fraktion,
  ueber_mich,
  kontakt_email,
  avatar_url,
  social_x,
  social_facebook,
  social_instagram,
  social_tiktok,
  verein_name
) on public.profiles to authenticated;

-- Policy zusätzlich härten: explizites WITH CHECK verhindert, dass die eigene Zeile
-- auf eine fremde id umgeschrieben wird (Defense-in-Depth zum Spalten-Grant oben).
drop policy if exists "Eigenes Profil bearbeiten" on public.profiles;
create policy "Eigenes Profil bearbeiten"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
