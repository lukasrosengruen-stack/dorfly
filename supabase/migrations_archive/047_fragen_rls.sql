-- 047_fragen_rls.sql
-- Drei Löcher: oeffentlich=true galt fuer public ohne Gemeinde-Filter,
-- Verwaltung sah und beantwortete Fragen fremder Gemeinden.
-- Neu: Login-Pflicht, Gemeinde-Filter ueberall.

drop policy if exists "Fragen lesen"       on public.fragen;
drop policy if exists "Fragen beantworten" on public.fragen;
drop policy if exists "Fragen stellen"     on public.fragen;

create policy "Fragen stellen"
  on public.fragen for insert to authenticated
  with check (
    fragesteller_id = auth.uid()
    and gemeinde_id = public.current_gemeinde_id()
  );

create policy "Fragen lesen"
  on public.fragen for select to authenticated
  using (
    fragesteller_id = auth.uid()
    or (
      gemeinde_id = public.current_gemeinde_id()
      and (
        oeffentlich = true
        or public.is_verwaltung()
      )
    )
  );

create policy "Fragen beantworten"
  on public.fragen for update to authenticated
  using (
    public.is_verwaltung()
    and gemeinde_id = public.current_gemeinde_id()
  )
  with check (
    public.is_verwaltung()
    and gemeinde_id = public.current_gemeinde_id()
  );
