-- Zusätzliche Termine für Veranstaltungs-Beiträge (mehrtägige oder wiederkehrende
-- Veranstaltungen). posts.veranstaltung_datum/veranstaltung_ort bleiben der Haupttermin;
-- post_termine enthält nur zusätzliche Termine (gleicher Titel/Inhalt/Ort wie der Post).

create table public.post_termine (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  datum timestamptz not null,
  created_at timestamptz not null default now()
);

create index post_termine_post_id_idx on public.post_termine(post_id);
create index post_termine_datum_idx on public.post_termine(datum);

alter table public.post_termine enable row level security;

grant select on public.post_termine to anon;
grant select, insert, update, delete on public.post_termine to authenticated;
grant select, insert, update, delete on public.post_termine to service_role;

create policy "post_termine_lesen" on public.post_termine
  for select using (true);

create policy "post_termine_eigene_verwalten" on public.post_termine
  for all
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
