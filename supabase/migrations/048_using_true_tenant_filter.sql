-- 048_using_true_tenant_filter.sql
-- SELECT stand ueberall auf using(true). Gemeindeuebergreifend lesbar,
-- organisationen sogar anonym. Neu: Login-Pflicht, Gemeinde-Filter.
-- Buerger sehen nur aktive Umfragen, Verwaltung alle.

drop policy if exists "Organisationen lesen" on public.organisationen;
create policy "Organisationen lesen"
  on public.organisationen for select to authenticated
  using (gemeinde_id = public.current_gemeinde_id());

drop policy if exists "vereine_read" on public.vereine;
create policy "vereine_read"
  on public.vereine for select to authenticated
  using (gemeinde_id = public.current_gemeinde_id());

drop policy if exists "umfragen_lesen" on public.umfragen;
create policy "umfragen_lesen"
  on public.umfragen for select to authenticated
  using (
    gemeinde_id = public.current_gemeinde_id()
    and (
      public.is_verwaltung()
      or enddatum is null
      or enddatum >= now()
    )
  );

drop policy if exists "umfrage_fragen_lesen" on public.umfrage_fragen;
create policy "umfrage_fragen_lesen"
  on public.umfrage_fragen for select to authenticated
  using (
    exists (
      select 1 from public.umfragen u
      where u.id = umfrage_fragen.umfrage_id
        and u.gemeinde_id = public.current_gemeinde_id()
        and (
          public.is_verwaltung()
          or u.enddatum is null
          or u.enddatum >= now()
        )
    )
  );

drop policy if exists "umfrage_optionen_lesen" on public.umfrage_optionen;
create policy "umfrage_optionen_lesen"
  on public.umfrage_optionen for select to authenticated
  using (
    exists (
      select 1
      from public.umfrage_fragen f
      join public.umfragen u on u.id = f.umfrage_id
      where f.id = umfrage_optionen.frage_id
        and u.gemeinde_id = public.current_gemeinde_id()
        and (
          public.is_verwaltung()
          or u.enddatum is null
          or u.enddatum >= now()
        )
    )
  );
