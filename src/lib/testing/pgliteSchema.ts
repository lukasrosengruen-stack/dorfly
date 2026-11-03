/**
 * Gemeinsames Schema für Datenbanktests mit PGlite (echtes Postgres als WASM).
 *
 * Bildet nur die Tabellen, Spalten und Fremdschlüssel nach, die die getesteten
 * Migrationen berühren — mit denselben Constraint-Namen und Cascade-Regeln wie in
 * Produktion. Darauf werden die echten Migrationsdateien ausgeführt.
 *
 * Abweichungen von Produktion, damit Tests knapp bleiben:
 *   * gemeinde_id ist überall nullable,
 *   * rollen_log.aktion hat einen Default,
 *   * Namensspalten haben Defaults.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

export function migration(datei: string): string {
  return readFileSync(path.resolve(__dirname, '../../../supabase/migrations', datei), 'utf8')
}

export const BASIS_SCHEMA = `
  create role anon;
  create role authenticated;
  create role service_role;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null,
    name text not null
  );

  create type public.user_role as enum
    ('buerger', 'organisation', 'verwaltung', 'super_admin', 'gewerbe', 'gemeinderat', 'verein');
  create type public.org_type as enum ('verein', 'gewerbe', 'institution');
  create type public.post_channel as enum ('gemeinde', 'verein', 'gewerbe', 'gemeinderat');

  create table public.gemeinden (id uuid primary key default gen_random_uuid(), logo_url text);

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    gemeinde_id uuid references public.gemeinden(id),
    role public.user_role not null default 'buerger',
    email text,
    display_name text,
    vorname text,
    nachname text,
    avatar_url text
  );

  create table public.organisationen (
    id uuid primary key default gen_random_uuid(),
    gemeinde_id uuid references public.gemeinden(id),
    profile_id uuid not null references public.profiles(id),
    name text not null default 'Gewerbe',
    typ public.org_type not null default 'gewerbe',
    logo_url text
  );
  create table public.vereine (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles(id) on delete cascade,
    gemeinde_id uuid references public.gemeinden(id),
    verein_name text not null default 'Verein',
    typ text not null default 'verein' check (typ in ('verein', 'organisation')),
    logo_url text
  );
  create table public.verein_abonnements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    verein_id uuid not null references public.vereine(id) on delete cascade
  );
  create table public.gewerbe_abonnements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    gewerbe_id uuid not null references public.organisationen(id) on delete cascade
  );

  create table public.posts (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.profiles(id),
    gemeinde_id uuid,
    org_id uuid,
    channel public.post_channel not null default 'gemeinde',
    bild_url text,
    bilder_urls text[]
  );
  create table public.post_termine (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.posts(id) on delete cascade
  );
  create table public.maengel (
    id uuid primary key default gen_random_uuid(),
    melder_id uuid not null references public.profiles(id),
    foto_url text
  );
  create table public.fragen (
    id uuid primary key default gen_random_uuid(),
    fragesteller_id uuid not null references public.profiles(id),
    antwort text
  );
  create table public.gemeinderat_fragen (
    id uuid primary key default gen_random_uuid(),
    fragesteller_id uuid not null references public.profiles(id) on delete cascade,
    gemeinderat_id uuid not null references public.profiles(id) on delete cascade
  );

  create table public.umfragen (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.profiles(id) on delete cascade,
    bilder_urls text[] not null default '{}'
  );
  create table public.umfrage_fragen (
    id uuid primary key default gen_random_uuid(),
    umfrage_id uuid not null references public.umfragen(id) on delete cascade,
    bilder_urls text[] not null default '{}'
  );
  create table public.umfrage_antworten (
    id uuid primary key default gen_random_uuid(),
    umfrage_id uuid not null references public.umfragen(id) on delete cascade,
    frage_id uuid not null references public.umfrage_fragen(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    antwort_text text
  );
  create table public.umfrage_teilnahmen (
    id uuid primary key default gen_random_uuid(),
    umfrage_id uuid not null references public.umfragen(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    unique (umfrage_id, user_id)
  );

  create table public.meldungen (
    id uuid primary key default gen_random_uuid(),
    melder_id uuid not null references auth.users(id) on delete cascade
  );
  create table public.abfallkalender_praeferenzen (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade
  );

  create table public.einladungen (
    id uuid primary key default gen_random_uuid(),
    gemeinde_id uuid,
    email text not null,
    rolle text not null default 'buerger',
    organisation_name text,
    verein_id uuid,
    org_id uuid,
    status text not null default 'offen'
      check (status in ('offen', 'angenommen', 'abgelaufen', 'widerrufen')),
    angenommen_am timestamptz,
    eingeladen_von uuid not null references public.profiles(id)
  );
  create table public.rollen_log (
    id uuid primary key default gen_random_uuid(),
    gemeinde_id uuid,
    aktion text not null default 'rolle_gesetzt'
      check (aktion in ('eingeladen', 'rolle_gesetzt', 'rolle_transfer', 'widerrufen')),
    ziel_profile_id uuid,
    ziel_email text not null,
    alte_rolle text,
    neue_rolle text,
    einladung_id uuid,
    ausgefuehrt_von uuid not null,
    erstellt_am timestamptz not null default now()
  );

  grant select, insert, update, delete on public.vereine to authenticated;
  grant select, insert, update, delete on public.organisationen to authenticated;
`
