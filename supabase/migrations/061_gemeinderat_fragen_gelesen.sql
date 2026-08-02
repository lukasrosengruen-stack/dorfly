-- Ungelesen-Status für Gemeinderats-Nachrichten.
--
-- Bisher hatte gemeinderat_fragen nur `status` (offen/beantwortet/archiviert).
-- Weder Bürger noch Gemeinderat konnten erkennen, ob eine Nachricht neu ist —
-- man musste aktiv in den Bereich navigieren und die Liste durchsehen.
--
-- Diese Migration legt nur die Felder an. Sie werden beim Öffnen des jeweiligen
-- Bereichs gesetzt (POST /api/gemeinderat/gelesen). Ein Badge kommt separat.
--
-- NULL = noch nicht gelesen.

alter table public.gemeinderat_fragen
  add column if not exists gelesen_von_buerger_at timestamptz,
  add column if not exists gelesen_von_rat_at     timestamptz;

comment on column public.gemeinderat_fragen.gelesen_von_buerger_at is
  'Zeitpunkt, zu dem der Fragesteller die Antwort gesehen hat. NULL = ungelesen.';
comment on column public.gemeinderat_fragen.gelesen_von_rat_at is
  'Zeitpunkt, zu dem der Gemeinderat die Frage gesehen hat. NULL = ungelesen.';

-- ─── GRANTs ───────────────────────────────────────────────────────────────────
-- Die Grants aus 016/019 (authenticated) und 031 (service_role) sind
-- tabellenweit und decken neue Spalten automatisch mit ab. Sie werden hier
-- wiederholt, damit die Migration für sich allein steht — GRANT ist additiv,
-- die bestehenden Rechte bleiben unverändert.
--
-- Wichtig: authenticated hat zwar UPDATE, die RLS-Policy
-- "gemeinderat_fragen_beantworten" (019) erlaubt es aber nur dem adressierten
-- Gemeinderat (gemeinderat_id = auth.uid()). Der Fragesteller kann sein eigenes
-- Lese-Flag darüber also nicht setzen. Beide Felder werden deshalb ausschließlich
-- über service_role in /api/gemeinderat/gelesen geschrieben — bewusst ohne
-- zusätzliche RLS-Policy, damit die Antwort-Spalte nicht schreibbar wird.

grant select, insert, update, delete on public.gemeinderat_fragen to authenticated;
grant select, insert, update, delete on public.gemeinderat_fragen to service_role;

-- Teilindex für die spätere Badge-Abfrage (nur ungelesene Zeilen).
create index if not exists gemeinderat_fragen_ungelesen_rat_idx
  on public.gemeinderat_fragen (gemeinderat_id)
  where gelesen_von_rat_at is null;

create index if not exists gemeinderat_fragen_ungelesen_buerger_idx
  on public.gemeinderat_fragen (fragesteller_id)
  where gelesen_von_buerger_at is null;
