-- Erstellt die Umfragen-Tabellenfamilie und gemeinderat_fragen.
-- Diese Features existieren im Code, hatten aber nie eine Migration.

-- ─── umfragen ────────────────────────────────────────────────────────────────
create table if not exists public.umfragen (
  id           uuid        primary key default gen_random_uuid(),
  gemeinde_id  uuid        not null references public.gemeinden(id) on delete cascade,
  author_id    uuid        not null references public.profiles(id) on delete cascade,
  titel        text        not null,
  beschreibung text,
  enddatum     timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table public.umfragen enable row level security;

grant select, insert, update, delete on public.umfragen to authenticated;

create policy "umfragen_lesen" on public.umfragen
  for select to authenticated using (true);

create policy "umfragen_verwalten" on public.umfragen
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and gemeinde_id = umfragen.gemeinde_id
        and role in ('verwaltung', 'super_admin')
    )
  );

-- ─── umfrage_fragen ──────────────────────────────────────────────────────────
create table if not exists public.umfrage_fragen (
  id           uuid    primary key default gen_random_uuid(),
  umfrage_id   uuid    not null references public.umfragen(id) on delete cascade,
  reihenfolge  integer not null default 0,
  frage_text   text    not null,
  typ          text    not null check (typ in ('ja_nein', 'einzelauswahl', 'mehrfachauswahl', 'bewertung'))
);

alter table public.umfrage_fragen enable row level security;

grant select, insert, update, delete on public.umfrage_fragen to authenticated;

create policy "umfrage_fragen_lesen" on public.umfrage_fragen
  for select to authenticated using (true);

create policy "umfrage_fragen_verwalten" on public.umfrage_fragen
  for all to authenticated
  using (
    exists (
      select 1 from public.umfragen u
      join public.profiles p on p.id = auth.uid()
      where u.id = umfrage_fragen.umfrage_id
        and p.gemeinde_id = u.gemeinde_id
        and p.role in ('verwaltung', 'super_admin')
    )
  );

-- ─── umfrage_optionen ────────────────────────────────────────────────────────
create table if not exists public.umfrage_optionen (
  id           uuid    primary key default gen_random_uuid(),
  frage_id     uuid    not null references public.umfrage_fragen(id) on delete cascade,
  option_text  text    not null,
  reihenfolge  integer not null default 0
);

alter table public.umfrage_optionen enable row level security;

grant select, insert, update, delete on public.umfrage_optionen to authenticated;

create policy "umfrage_optionen_lesen" on public.umfrage_optionen
  for select to authenticated using (true);

create policy "umfrage_optionen_verwalten" on public.umfrage_optionen
  for all to authenticated
  using (
    exists (
      select 1 from public.umfrage_fragen f
      join public.umfragen u on u.id = f.umfrage_id
      join public.profiles p on p.id = auth.uid()
      where f.id = umfrage_optionen.frage_id
        and p.gemeinde_id = u.gemeinde_id
        and p.role in ('verwaltung', 'super_admin')
    )
  );

-- ─── umfrage_antworten ───────────────────────────────────────────────────────
create table if not exists public.umfrage_antworten (
  id           uuid primary key default gen_random_uuid(),
  umfrage_id   uuid not null references public.umfragen(id) on delete cascade,
  frage_id     uuid not null references public.umfrage_fragen(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  antwort_text text,
  option_id    uuid references public.umfrage_optionen(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.umfrage_antworten enable row level security;

grant select, insert, delete on public.umfrage_antworten to authenticated;

create policy "umfrage_antworten_eigene_lesen" on public.umfrage_antworten
  for select to authenticated using (user_id = auth.uid());

create policy "umfrage_antworten_einfuegen" on public.umfrage_antworten
  for insert to authenticated with check (user_id = auth.uid());

create policy "umfrage_antworten_loeschen" on public.umfrage_antworten
  for delete to authenticated using (user_id = auth.uid());

-- ─── umfrage_teilnahmen ──────────────────────────────────────────────────────
create table if not exists public.umfrage_teilnahmen (
  id         uuid        primary key default gen_random_uuid(),
  umfrage_id uuid        not null references public.umfragen(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (umfrage_id, user_id)
);

alter table public.umfrage_teilnahmen enable row level security;

grant select, insert, delete on public.umfrage_teilnahmen to authenticated;

create policy "umfrage_teilnahmen_eigene" on public.umfrage_teilnahmen
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── gemeinderat_fragen ──────────────────────────────────────────────────────
create table if not exists public.gemeinderat_fragen (
  id               uuid        primary key default gen_random_uuid(),
  gemeinde_id      uuid        not null references public.gemeinden(id) on delete cascade,
  fragesteller_id  uuid        not null references public.profiles(id) on delete cascade,
  gemeinderat_id   uuid        not null references public.profiles(id) on delete cascade,
  frage            text        not null,
  antwort          text,
  status           text        not null default 'offen'
    check (status in ('offen', 'beantwortet', 'archiviert')),
  created_at       timestamptz not null default now()
);

alter table public.gemeinderat_fragen enable row level security;

grant select, insert, update, delete on public.gemeinderat_fragen to authenticated;

create policy "gemeinderat_fragen_lesen" on public.gemeinderat_fragen
  for select to authenticated using (
    fragesteller_id = auth.uid()
    or gemeinderat_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and gemeinde_id = gemeinderat_fragen.gemeinde_id
        and role in ('verwaltung', 'super_admin')
    )
  );

create policy "gemeinderat_fragen_stellen" on public.gemeinderat_fragen
  for insert to authenticated with check (fragesteller_id = auth.uid());

create policy "gemeinderat_fragen_beantworten" on public.gemeinderat_fragen
  for update to authenticated using (gemeinderat_id = auth.uid());
