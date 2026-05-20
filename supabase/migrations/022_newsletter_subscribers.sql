-- Newsletter-Abonnenten mit Double-Opt-in
-- Status: pending -> confirmed (nach E-Mail-Klick) | unsubscribed (nach Abmeldung)

create table public.newsletter_subscribers (
  id                 uuid        primary key default gen_random_uuid(),
  email              text        not null unique,
  first_name         text        not null,
  last_name          text        not null,
  municipality       text,
  status             text        not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirmation_token uuid        not null default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  confirmed_at       timestamptz
);

alter table public.newsletter_subscribers enable row level security;

-- Nur service_role darf lesen und schreiben (kein direkter Client-Zugriff)
grant select, insert, update on public.newsletter_subscribers to service_role;
