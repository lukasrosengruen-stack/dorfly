-- 045_einladungen_rls_superadmin.sql
-- Super-Admin hat gemeinde_id = null. Alle drei Policies verglichen
-- profiles.gemeinde_id mit einladungen.gemeinde_id. Der Vergleich ergab
-- NULL, also falsy. Der Insert lief in with_check auf, das nachgelagerte
-- .select('token') in der SELECT-Policy. Fehler war still, HTTP 200.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'::user_role
  )
$$;

grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "einladungen_erstellen"     on public.einladungen;
drop policy if exists "einladungen_lesen"         on public.einladungen;
drop policy if exists "einladungen_aktualisieren" on public.einladungen;

-- Super-Admin lädt in jede Gemeinde ein. Verwaltung nur in die eigene.
create policy "einladungen_erstellen"
  on public.einladungen for insert to authenticated
  with check (
    eingeladen_von = auth.uid()
    and (
      public.is_super_admin()
      or (
        public.is_verwaltung()
        and gemeinde_id = public.current_gemeinde_id()
      )
    )
  );

create policy "einladungen_lesen"
  on public.einladungen for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_verwaltung()
      and gemeinde_id = public.current_gemeinde_id()
    )
  );

create policy "einladungen_aktualisieren"
  on public.einladungen for update to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_verwaltung()
      and gemeinde_id = public.current_gemeinde_id()
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.is_verwaltung()
      and gemeinde_id = public.current_gemeinde_id()
    )
  );
