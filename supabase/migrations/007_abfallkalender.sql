-- ─── Abfallkalender Feature ───────────────────────────────────────────────────
-- Fügt Multi-Tenant Abfallkalender hinzu: Termine, Gemeinde-Einstellungen,
-- Nutzer-Präferenzen und ein Feature-Flag-Feld an gemeinden.

-- Feature-Flags pro Gemeinde (JSON-Spalte)
ALTER TABLE gemeinden
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}';

-- Kommentar: features-Struktur: { "wasteCalendarEnabled": true }

-- ─── Abfalltermine ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abfalltermine (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gemeinde_id   uuid        NOT NULL REFERENCES gemeinden(id) ON DELETE CASCADE,
  typ           text        NOT NULL,
  datum         date        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gemeinde_id, typ, datum)
);

CREATE INDEX IF NOT EXISTS abfalltermine_gemeinde_datum
  ON abfalltermine(gemeinde_id, datum);

-- ─── Abfallkalender-Einstellungen pro Gemeinde ────────────────────────────────
CREATE TABLE IF NOT EXISTS abfallkalender_einstellungen (
  gemeinde_id       uuid        PRIMARY KEY REFERENCES gemeinden(id) ON DELETE CASCADE,
  verfuegbare_typen text[]      NOT NULL DEFAULT '{}',
  importiert_am     timestamptz,
  importiert_von    text,
  erstellt_am       timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am   timestamptz NOT NULL DEFAULT now()
);

-- ─── Nutzer-Präferenzen (pro Nutzer × Gemeinde) ───────────────────────────────
CREATE TABLE IF NOT EXISTS abfallkalender_praeferenzen (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gemeinde_id              uuid        NOT NULL REFERENCES gemeinden(id) ON DELETE CASCADE,
  ausgewaehlte_typen       text[]      NOT NULL DEFAULT '{}',
  push_aktiviert           boolean     NOT NULL DEFAULT true,
  email_aktiviert          boolean     NOT NULL DEFAULT false,
  benachrichtigung_uhrzeit text        NOT NULL DEFAULT '18:00',
  erstellt_am              timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, gemeinde_id)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE abfalltermine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abfalltermine_select" ON abfalltermine
  FOR SELECT USING (true);

-- Schreibzugriff nur über Service Role (API-Routen mit createServiceClient)
CREATE POLICY "abfalltermine_insert_service" ON abfalltermine
  FOR INSERT WITH CHECK (false);
CREATE POLICY "abfalltermine_delete_service" ON abfalltermine
  FOR DELETE USING (false);


ALTER TABLE abfallkalender_einstellungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abfallkalender_einstellungen_select" ON abfallkalender_einstellungen
  FOR SELECT USING (true);

CREATE POLICY "abfallkalender_einstellungen_write_service" ON abfallkalender_einstellungen
  FOR ALL USING (false);


ALTER TABLE abfallkalender_praeferenzen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "praeferenzen_eigene_select" ON abfallkalender_praeferenzen
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "praeferenzen_eigene_insert" ON abfallkalender_praeferenzen
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "praeferenzen_eigene_update" ON abfallkalender_praeferenzen
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "praeferenzen_eigene_delete" ON abfallkalender_praeferenzen
  FOR DELETE USING (auth.uid() = user_id);
