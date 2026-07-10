-- 044_maengel_rls.sql
-- Sichert maengel gegen Cross-Tenant-Zugriff und anonymes Lesen.

alter table public.maengel enable row level security;

drop policy if exists "Mängel melden"    on public.maengel;
drop policy if exists "Mängel lesen"     on public.maengel;
drop policy if exists "Mängel verwalten" on public.maengel;

-- Bürger legt Mangel an. Nur in eigenem Namen, nur in eigener Gemeinde.
create policy "maengel_insert_eigene"
  on public.maengel for insert to authenticated
  with check (
    melder_id = auth.uid()
    and gemeinde_id = public.current_gemeinde_id()
  );

-- Bürger sieht eigene Meldungen. Verwaltung sieht alle ihrer Gemeinde.
create policy "maengel_select"
  on public.maengel for select to authenticated
  using (
    melder_id = auth.uid()
    or (
      public.is_verwaltung()
      and gemeinde_id = public.current_gemeinde_id()
    )
  );

-- Nur Verwaltung, nur eigene Gemeinde. Zweites Netz hinter der API-Route.
create policy "maengel_update_verwaltung"
  on public.maengel for update to authenticated
  using (
    public.is_verwaltung()
    and gemeinde_id = public.current_gemeinde_id()
  )
  with check (
    public.is_verwaltung()
    and gemeinde_id = public.current_gemeinde_id()
  );

-- Kein DELETE für authenticated. Löschen läuft ausschließlich über Service-Role.

grant select, insert, update on public.maengel to authenticated;
grant all on public.maengel to service_role;
