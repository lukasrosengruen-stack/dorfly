-- ── Verein-Kategorien ─────────────────────────────────────────────────────────
create table if not exists public.verein_kategorien (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reihenfolge integer not null default 0
);

insert into public.verein_kategorien (name, reihenfolge) values
  ('Sport',              1),
  ('Kultur & Brauchtum', 2),
  ('Musik',              3),
  ('Blaulicht',          4),
  ('Soziales',           5),
  ('Natur & Umwelt',     6),
  ('Politik',            7),
  ('Religion',           8),
  ('Sonstige',           9);

-- ── Vereine ───────────────────────────────────────────────────────────────────
create table if not exists public.vereine (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references public.profiles(id) on delete cascade,
  gemeinde_id uuid not null references public.gemeinden(id) on delete cascade,
  verein_name text not null,
  typ         text not null check (typ in ('verein', 'organisation')),
  kategorie_id uuid references public.verein_kategorien(id) on delete set null,
  beschreibung text,
  website     text,
  logo_url    text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Verein-Abonnements ────────────────────────────────────────────────────────
create table if not exists public.verein_abonnements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  verein_id  uuid not null references public.vereine(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, verein_id)
);

-- ── Posts: sichtbarkeit-Spalte ────────────────────────────────────────────────
-- Nur relevant für channel = 'verein'. Werte: null/'abonnenten' oder 'alle'
alter table public.posts
  add column if not exists sichtbarkeit text check (sichtbarkeit in ('alle', 'abonnenten'));

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.verein_kategorien enable row level security;
alter table public.vereine           enable row level security;
alter table public.verein_abonnements enable row level security;

-- Kategorien: alle authentifizierten Nutzer dürfen lesen
create policy "verein_kategorien_read" on public.verein_kategorien
  for select to authenticated using (true);

-- Vereine: alle authentifizierten Nutzer dürfen lesen
create policy "vereine_read" on public.vereine
  for select to authenticated using (true);

-- Vereine: Eigentümer darf anlegen/aktualisieren/löschen
create policy "vereine_insert_own" on public.vereine
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "vereine_update_own" on public.vereine
  for update to authenticated
  using (profile_id = auth.uid());

create policy "vereine_delete_own" on public.vereine
  for delete to authenticated
  using (profile_id = auth.uid());

-- Abonnements: Nutzer darf eigene lesen/anlegen/löschen
create policy "verein_abonnements_read_own" on public.verein_abonnements
  for select to authenticated using (user_id = auth.uid());

create policy "verein_abonnements_insert_own" on public.verein_abonnements
  for insert to authenticated with check (user_id = auth.uid());

create policy "verein_abonnements_delete_own" on public.verein_abonnements
  for delete to authenticated using (user_id = auth.uid());
