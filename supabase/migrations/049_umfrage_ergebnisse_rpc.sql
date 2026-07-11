-- 049_umfrage_ergebnisse_rpc.sql
-- Verwaltung braucht Auszaehlungen, ohne user_id zu sehen.
-- Anonymitaet bleibt gewahrt: beide Funktionen geben nur Zahlen zurueck.
-- Zugriff nur fuer Verwaltung der eigenen Gemeinde.

create or replace function public.umfrage_ergebnisse(p_umfrage_id uuid)
returns table (
  frage_id uuid,
  option_id uuid,
  antwort_text text,
  anzahl bigint
)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select
    a.frage_id,
    a.option_id,
    a.antwort_text,
    count(*) as anzahl
  from public.umfrage_antworten a
  join public.umfragen u on u.id = a.umfrage_id
  where a.umfrage_id = p_umfrage_id
    and u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
  group by a.frage_id, a.option_id, a.antwort_text
$$;

grant execute on function public.umfrage_ergebnisse(uuid) to authenticated;

create or replace function public.umfrage_teilnehmer_anzahl(p_umfrage_id uuid)
returns bigint
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select count(*)
  from public.umfrage_teilnahmen t
  join public.umfragen u on u.id = t.umfrage_id
  where t.umfrage_id = p_umfrage_id
    and u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
$$;

grant execute on function public.umfrage_teilnehmer_anzahl(uuid) to authenticated;
