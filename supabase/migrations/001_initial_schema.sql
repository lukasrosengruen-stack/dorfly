-- Dorfly MVP – Initial Schema
-- Run this in your Supabase SQL editor

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";  -- for GPS coordinates

-- ─── Enums ───────────────────────────────────────────────────────────────────
create type user_role as enum ('buerger', 'organisation', 'verwaltung', 'super_admin');
create type org_type  as enum ('verein', 'gewerbe', 'institution');
create type post_channel as enum ('gemeinde', 'verein', 'gewerbe');
create type maengel_status as enum ('offen', 'in_bearbeitung', 'erledigt');
create type frage_status as enum ('offen', 'beantwortet', 'archiviert');

-- ─── Gemeinden (Municipalities) ──────────────────────────────────────────────
create table gemeinden (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  bundesland    text not null,
  einwohner     integer check (einwohner <= 10000),
  plz           text,
  slug          text unique not null,
  logo_url      text,
  created_at    timestamptz default now()
);

-- ─── Profiles (extends Supabase auth.users) ──────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  gemeinde_id   uuid references gemeinden(id),
  phone         text unique not null,
  display_name  text,
  role          user_role not null default 'buerger',
  avatar_url    text,
  phone_verified boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── Organisations ───────────────────────────────────────────────────────────
create table organisationen (
  id            uuid primary key default uuid_generate_v4(),
  gemeinde_id   uuid not null references gemeinden(id),
  profile_id    uuid not null references profiles(id),
  name          text not null,
  typ           org_type not null,
  beschreibung  text,
  logo_url      text,
  website       text,
  verified      boolean default false,
  created_at    timestamptz default now()
);

-- ─── Posts (Newsfeed) ────────────────────────────────────────────────────────
create table posts (
  id            uuid primary key default uuid_generate_v4(),
  gemeinde_id   uuid not null references gemeinden(id),
  author_id     uuid not null references profiles(id),
  org_id        uuid references organisationen(id),
  channel       post_channel not null,
  titel         text not null,
  inhalt        text not null,
  bild_url      text,
  pinned        boolean default false,
  published_at  timestamptz default now(),
  created_at    timestamptz default now()
);

create index posts_gemeinde_channel_idx on posts(gemeinde_id, channel, published_at desc);

-- ─── Mängelmelder ────────────────────────────────────────────────────────────
create table maengel (
  id            uuid primary key default uuid_generate_v4(),
  gemeinde_id   uuid not null references gemeinden(id),
  melder_id     uuid not null references profiles(id),
  titel         text not null,
  beschreibung  text,
  foto_url      text,
  lat           double precision,
  lng           double precision,
  adresse       text,
  status        maengel_status default 'offen',
  notiz_intern  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index maengel_gemeinde_status_idx on maengel(gemeinde_id, status, created_at desc);

-- ─── Frag den Bürgermeister ──────────────────────────────────────────────────
create table fragen (
  id            uuid primary key default uuid_generate_v4(),
  gemeinde_id   uuid not null references gemeinden(id),
  fragesteller_id uuid not null references profiles(id),
  frage         text not null,
  antwort       text,
  oeffentlich   boolean default true,
  status        frage_status default 'offen',
  beantwortet_at timestamptz,
  created_at    timestamptz default now()
);

create index fragen_gemeinde_idx on fragen(gemeinde_id, oeffentlich, created_at desc);

-- ─── SMS Verifications ───────────────────────────────────────────────────────
create table sms_verifications (
  id            uuid primary key default uuid_generate_v4(),
  phone         text not null,
  code          text not null,
  expires_at    timestamptz not null,
  used          boolean default false,
  created_at    timestamptz default now()
);

create index sms_verif_phone_idx on sms_verifications(phone, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table gemeinden         enable row level security;
alter table profiles          enable row level security;
alter table organisationen    enable row level security;
alter table posts             enable row level security;
alter table maengel           enable row level security;
alter table fragen            enable row level security;
alter table sms_verifications enable row level security;

-- Gemeinden: everyone can read
create policy "Gemeinden lesbar" on gemeinden for select using (true);

-- Profiles: user sees own, verwaltung sees all in Gemeinde
create policy "Eigenes Profil lesen" on profiles for select
  using (id = auth.uid());
create policy "Eigenes Profil bearbeiten" on profiles for update
  using (id = auth.uid());
create policy "Profil anlegen" on profiles for insert
  with check (id = auth.uid());

-- Posts: anyone in Gemeinde can read; org/verwaltung can write
create policy "Posts lesen" on posts for select using (true);
create policy "Posts erstellen" on posts for insert
  with check (
    auth.uid() = author_id and
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('organisation','verwaltung','super_admin')
    )
  );
create policy "Posts bearbeiten" on posts for update
  using (author_id = auth.uid());

-- Mängel: authenticated users can create; verwaltung can update
create policy "Mängel lesen" on maengel for select using (true);
create policy "Mängel melden" on maengel for insert
  with check (auth.uid() = melder_id);
create policy "Mängel verwalten" on maengel for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('verwaltung','super_admin')
    )
  );

-- Fragen: public ones everyone reads; private only fragesteller + verwaltung
create policy "Fragen lesen" on fragen for select
  using (
    oeffentlich = true
    or fragesteller_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('verwaltung','super_admin')
    )
  );
create policy "Fragen stellen" on fragen for insert
  with check (auth.uid() = fragesteller_id);
create policy "Fragen beantworten" on fragen for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('verwaltung','super_admin')
    )
  );

-- SMS: server-side only (service_role key)
create policy "SMS intern" on sms_verifications for all
  using (false);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger maengel_updated_at before update on maengel
  for each row execute function set_updated_at();
