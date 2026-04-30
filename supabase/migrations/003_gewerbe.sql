-- Lokale Angebote – Gewerbe-Feature
-- Erweitert organisationen um Gewerbe-Felder, fügt Abonnements hinzu.

-- ─── Rolle ────────────────────────────────────────────────────────────────────
alter type user_role add value if not exists 'gewerbe';

-- ─── Organisationen: Gewerbe-Felder ──────────────────────────────────────────
alter table organisationen
  add column if not exists branche       text,
  add column if not exists adresse       text,
  add column if not exists oeffnungszeiten text,
  add column if not exists plan          text not null default 'standard';

-- ─── Gewerbe-Abonnements ─────────────────────────────────────────────────────
create table if not exists gewerbe_abonnements (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  gewerbe_id  uuid not null references organisationen(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, gewerbe_id)
);

create index if not exists gewerbe_abonnements_user_idx
  on gewerbe_abonnements(user_id);
create index if not exists gewerbe_abonnements_gewerbe_idx
  on gewerbe_abonnements(gewerbe_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table gewerbe_abonnements enable row level security;

create policy "Eigene Abonnements lesen"
  on gewerbe_abonnements for select
  using (user_id = auth.uid());

create policy "Abonnieren"
  on gewerbe_abonnements for insert
  with check (user_id = auth.uid());

create policy "Abonnement kündigen"
  on gewerbe_abonnements for delete
  using (user_id = auth.uid());

-- Gewerbe kann seine Abonnenten zählen (kein Einblick in Identität)
create policy "Gewerbe sieht Anzahl"
  on gewerbe_abonnements for select
  using (
    exists (
      select 1 from organisationen o
      where o.id = gewerbe_id
        and o.profile_id = auth.uid()
    )
  );
