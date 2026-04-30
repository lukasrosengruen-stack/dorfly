-- Gewerbe-Branchen Lookup-Tabelle + FK in organisationen

-- ─── Lookup-Tabelle ───────────────────────────────────────────────────────────
create table gewerbe_branchen (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  reihenfolge int  not null default 0
);

insert into gewerbe_branchen (name, reihenfolge) values
  ('Lebensmittel & Getränke', 1),
  ('Gastronomie',             2),
  ('Gesundheit & Pflege',     3),
  ('Handwerk & Bau',          4),
  ('Handel & Einkaufen',      5),
  ('Dienstleistungen',        6),
  ('Freizeit & Sport',        7),
  ('Immobilien & Finanzen',   8),
  ('Sonstiges',               9);

alter table gewerbe_branchen enable row level security;
create policy "Branchen lesen" on gewerbe_branchen for select using (true);

-- ─── organisationen: branche (text) → branche_id (FK) ────────────────────────
alter table organisationen
  drop column if exists branche,
  add column branche_id uuid references gewerbe_branchen(id) on delete set null;
