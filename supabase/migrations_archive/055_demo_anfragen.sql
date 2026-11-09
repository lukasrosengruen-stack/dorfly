-- Fallback-Speicher für Demo-Anfragen, falls der Resend-Mailversand fehlschlägt
-- (siehe src/app/api/demo/route.ts). Normalfall: Anfrage geht per E-Mail raus und
-- wird NICHT gespeichert. Nur bei Versandfehler landet sie hier, damit nichts verloren geht.

create table public.demo_anfragen (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  gemeinde     text        not null,
  email        text        not null,
  nachricht    text,
  fehlergrund  text,
  created_at   timestamptz not null default now()
);

alter table public.demo_anfragen enable row level security;

-- Nur service_role greift zu (API-Route mit Service-Client), kein Client-Zugriff nötig
grant select, insert on public.demo_anfragen to service_role;

create policy "demo_anfragen_service_only"
  on public.demo_anfragen
  for all
  using (false);
