create table public.meldungen (
  id          uuid primary key default gen_random_uuid(),
  gemeinde_id uuid not null references public.gemeinden(id) on delete cascade,
  melder_id   uuid not null references auth.users(id) on delete cascade,
  inhalt_typ  text not null check (inhalt_typ in ('post', 'mangel', 'frage', 'antwort')),
  inhalt_id   uuid not null,
  grund       text not null check (grund in ('illegal', 'spam', 'beleidigung', 'falsch', 'sonstiges')),
  beschreibung text,
  status      text not null default 'offen' check (status in ('offen', 'geprueft', 'abgelehnt')),
  created_at  timestamptz not null default now()
);

alter table public.meldungen enable row level security;

grant select, insert on public.meldungen to authenticated;

create policy "Jeder eingeloggte Bürger kann melden"
  on public.meldungen for insert
  to authenticated
  with check (auth.uid() = melder_id);

create policy "Verwaltung sieht Meldungen ihrer Gemeinde"
  on public.meldungen for select
  to authenticated
  using (
    gemeinde_id in (
      select gemeinde_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('verwaltung', 'super_admin')
    )
  );
