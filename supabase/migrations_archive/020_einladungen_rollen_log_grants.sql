-- Explizite GRANTs und RLS-Policies für einladungen und rollen_log.
-- Bisher ausschließlich über service_role zugegriffen – ohne korrekten
-- Service-Role-Key in Vercel schlägt jeder Zugriff mit "permission denied" fehl.
-- Lösung: authenticated-Rolle erhält Zugriff, RLS-Policies sichern die Daten.

-- ─── einladungen ─────────────────────────────────────────────────────────────
grant select, insert, update on public.einladungen to authenticated;

create policy "einladungen_lesen" on public.einladungen
  for select to authenticated using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and gemeinde_id = einladungen.gemeinde_id
        and role in ('verwaltung', 'super_admin')
    )
  );

create policy "einladungen_erstellen" on public.einladungen
  for insert to authenticated with check (
    eingeladen_von = auth.uid() and
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and gemeinde_id = einladungen.gemeinde_id
        and role in ('verwaltung', 'super_admin')
    )
  );

create policy "einladungen_aktualisieren" on public.einladungen
  for update to authenticated using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and gemeinde_id = einladungen.gemeinde_id
        and role in ('verwaltung', 'super_admin')
    )
  );

-- ─── rollen_log ──────────────────────────────────────────────────────────────
-- GRANT select, insert bereits in 016_missing_grants.sql

create policy "rollen_log_lesen" on public.rollen_log
  for select to authenticated using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and gemeinde_id = rollen_log.gemeinde_id
        and role in ('verwaltung', 'super_admin')
    )
  );

create policy "rollen_log_schreiben" on public.rollen_log
  for insert to authenticated with check (ausgefuehrt_von = auth.uid());

-- ─── Ablauf-Funktion auch für authenticated freigeben ────────────────────────
grant execute on function public.einladungen_ablauf_aktualisieren() to authenticated;
