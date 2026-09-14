-- 062_umfrage_teilnehmer_anzahlen.sql
-- Sammel-Variante von umfrage_teilnehmer_anzahl (049).
-- Das Dashboard brauchte bisher einen Aufruf pro Umfrage; diese Funktion
-- liefert alle Zahlen der eigenen Gemeinde in einem Aufruf.
--
-- Sicherheitsmodell identisch zu 049: security definer mit abgeschaltetem
-- row_security, aber intern auf die eigene Gemeinde und die Verwaltungsrolle
-- eingeschraenkt. Kein Parameter — die Gemeinde kommt aus der Session, nicht
-- aus dem Aufruf, damit niemand fremde Gemeinden abfragen kann.
-- Anonymitaet bleibt gewahrt: es werden nur Zahlen zurueckgegeben.

create or replace function public.umfrage_teilnehmer_anzahlen()
returns table (
  umfrage_id uuid,
  anzahl bigint
)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select t.umfrage_id, count(*) as anzahl
  from public.umfrage_teilnahmen t
  join public.umfragen u on u.id = t.umfrage_id
  where u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
  group by t.umfrage_id
$$;

grant execute on function public.umfrage_teilnehmer_anzahlen() to authenticated;
