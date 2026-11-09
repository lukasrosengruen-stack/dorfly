-- SICHERHEIT: Gleiches Muster wie 057 (Schreibrechte ohne WITH CHECK) auf weiteren
-- Tabellen schließen. Betroffen: posts (HOCH), organisationen & vereine (MITTEL).
-- maengel (044) und fragen (047) waren bereits korrekt mit WITH CHECK abgesichert.

-- ── posts ─────────────────────────────────────────────────────────────────────
-- Problem: Policy "Posts bearbeiten" (001) = `using (author_id = auth.uid())` OHNE
-- WITH CHECK, plus tabellenweites Schreibrecht. Ein Autor (gewerbe/verein/verwaltung)
-- konnte seinen eigenen Post per direktem PostgREST-Zugriff beliebig umschreiben:
--   • status -> 'published'  → Moderation/Freigabe umgehen
--   • channel -> 'warnung', pinned=true, hohe severity → gefälschte offizielle Warnmeldung
--   • gemeinde_id -> fremd   → Post in fremden Gemeinde-Feed einschleusen
--   • author_id -> fremd     → Inhalt einem anderen Nutzer unterschieben
-- Verifiziert: ALLE posts-INSERT/UPDATE/DELETE laufen ausschließlich über service_role
-- (cron, posts/update, posts/freigeben, gewerbe/post, verein/post, gemeinderat/post,
-- warnmeldungen/*). authenticated braucht daher nur SELECT (Feed-Anzeige).
revoke insert, update, delete on public.posts from authenticated;

-- ── organisationen (Gewerbe) ──────────────────────────────────────────────────
-- Problem: "Gewerbe bearbeiten" (004) = `using(...)` OHNE WITH CHECK. Der Eigentümer
-- konnte gemeinde_id ändern und sein Gewerbe ins Verzeichnis einer fremden Gemeinde
-- verschieben. Fix: WITH CHECK pinnt Eigentümer und Gemeinde; alle übrigen Felder
-- (name, adresse, website, …) bleiben editierbar.
drop policy if exists "Gewerbe bearbeiten" on public.organisationen;
create policy "Gewerbe bearbeiten"
  on public.organisationen for update to authenticated
  using (
    profile_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'gewerbe'
    )
  )
  with check (
    profile_id = auth.uid()
    and gemeinde_id = public.current_gemeinde_id()
  );

-- ── vereine ───────────────────────────────────────────────────────────────────
-- Problem: "vereine_update_own" (008) = `using (profile_id = auth.uid())` OHNE
-- WITH CHECK → Verein in fremde Gemeinde verschiebbar. Fix analog zu oben.
drop policy if exists "vereine_update_own" on public.vereine;
create policy "vereine_update_own"
  on public.vereine for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and gemeinde_id = public.current_gemeinde_id()
  );
