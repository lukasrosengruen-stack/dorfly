-- Zwei Spalten, die auf der alten DB manuell angelegt und nie als Migration
-- erfasst wurden. Am 09.07.2026 manuell auf dorfly-production nachgezogen.

alter table public.maengel
  add column if not exists nachricht_an_buerger text,
  add column if not exists status_updated_at timestamp with time zone;
