-- 065: Mehrere Autoren und Verwalter pro Verein, Organisation und Gewerbe.
--
-- Bisher gehörte ein Verein (vereine, Rollen verein/organisation) bzw. ein Gewerbe
-- (organisationen, Rolle gewerbe) genau einem Konto (profile_id). Löschte dieses
-- Konto sich, löschte die Cascade den Verein samt Abonnenten und Beiträgen.
--
-- Jetzt hängen die Rechte an public.mitgliedschaften:
--   * eine Person ist Mitglied in höchstens EINEM Verein/Gewerbe (profile_id ist PK),
--   * Mitgliedsrolle 'verwalter' (Profil, Mitglieder, Löschen) oder 'autor' (Beiträge),
--   * profiles.role ist verein/organisation/gewerbe genau dann, wenn es eine
--     Mitgliedschaft gibt (Ausnahme: Selbstanlage steht noch aus). Rolle und
--     Mitgliedschaft ändern nur die Funktionen unten, jeweils in einer Transaktion.
--
-- Rückwärtskompatibel: Alter Code (liest vereine.profile_id) läuft bis zum Deploy
-- weiter. NACH dem Deploy 066 einspielen.
--
-- Spec: docs/superpowers/specs/2026-11-02-vereins-mitglieder-design.md
-- Kontolöschung ändert sich mit — /konto-loeschen und Datenschutzerklärung (Ziffer 7)
-- beschreiben das neue Verhalten.

-- ─── Vorbedingung: niemand ist mehreren Vereinen/Gewerben zugeordnet ─────────
do $$
declare
  v_anzahl int;
begin
  select count(*) into v_anzahl
  from (
    select profile_id
    from (
      select profile_id from public.vereine where profile_id is not null
      union all
      select profile_id from public.organisationen where profile_id is not null
    ) x
    group by profile_id
    having count(*) > 1
  ) d;

  if v_anzahl > 0 then
    raise exception '065: % Konten sind mehreren Vereinen/Gewerben zugeordnet. Vorher bereinigen.', v_anzahl;
  end if;
end $$;

-- ─── Eigentümer-Spalten lockern (werden nicht mehr gelesen, später entfernt) ─
alter table public.vereine alter column profile_id drop not null;
alter table public.vereine drop constraint if exists vereine_profile_id_key;
alter table public.vereine drop constraint if exists vereine_profile_id_fkey;
alter table public.vereine
  add constraint vereine_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

alter table public.organisationen alter column profile_id drop not null;
alter table public.organisationen drop constraint if exists organisationen_profile_id_fkey;
alter table public.organisationen
  add constraint organisationen_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- ─── Beiträge überleben ihren Autor (Vereins- und Gewerbebeiträge) ───────────
-- Constraint-Name bleibt gleich: Abfragen nutzen profiles_public!posts_author_id_fkey.
alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

-- Alt-Beiträge ohne org_id dem Verein/Gewerbe ihres Autors zuordnen. Rechte und
-- Anzeige hängen ab jetzt an org_id, nicht mehr an author_id.
update public.posts p
   set org_id = v.id
  from public.vereine v
 where p.channel::text = 'verein'
   and p.org_id is null
   and v.profile_id = p.author_id;

update public.posts p
   set org_id = o.id
  from public.organisationen o
 where p.channel::text = 'gewerbe'
   and p.org_id is null
   and o.profile_id = p.author_id;

-- ─── Mitgliedschaften ────────────────────────────────────────────────────────
create table public.mitgliedschaften (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  verein_id        uuid references public.vereine(id) on delete cascade,
  organisation_id  uuid references public.organisationen(id) on delete cascade,
  rolle            text not null check (rolle in ('verwalter', 'autor')),
  hinzugefuegt_von uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint mitgliedschaften_genau_ein_ziel check (num_nonnulls(verein_id, organisation_id) = 1)
);

create index mitgliedschaften_verein_idx on public.mitgliedschaften (verein_id);
create index mitgliedschaften_organisation_idx on public.mitgliedschaften (organisation_id);

alter table public.mitgliedschaften enable row level security;

-- Nur die eigene Zeile. Mitgliederlisten lädt der Server mit service_role nach der
-- Berechtigungsprüfung — eine Policy „Mitglieder desselben Vereins“ auf derselben
-- Tabelle wäre rekursiv.
create policy "mitgliedschaften_eigene_lesen" on public.mitgliedschaften
  for select to authenticated
  using (profile_id = auth.uid());

grant select on public.mitgliedschaften to authenticated;
grant select, insert, update, delete on public.mitgliedschaften to service_role;

-- Backfill: bisherige Eigentümer werden Verwalter
insert into public.mitgliedschaften (profile_id, verein_id, rolle)
select profile_id, id, 'verwalter' from public.vereine where profile_id is not null
on conflict (profile_id) do nothing;

insert into public.mitgliedschaften (profile_id, organisation_id, rolle)
select profile_id, id, 'verwalter' from public.organisationen where profile_id is not null
on conflict (profile_id) do nothing;

-- ─── Einladungen in einen bestehenden Verein ─────────────────────────────────
alter table public.einladungen
  add column if not exists mitglied_rolle text
  check (mitglied_rolle in ('verwalter', 'autor'));

-- ─── Rollen-Protokoll: neue Aktionen ─────────────────────────────────────────
-- Name der Constraint ist in Produktion nicht gesichert (Tabelle wurde früher von
-- Hand angelegt) — deshalb über pg_constraint suchen, wie in 011.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.rollen_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%aktion%';

  if v_constraint is not null then
    execute format('alter table public.rollen_log drop constraint %I', v_constraint);
  end if;

  alter table public.rollen_log
    add constraint rollen_log_aktion_check
    check (aktion in (
      'eingeladen', 'rolle_gesetzt', 'rolle_transfer', 'widerrufen',
      'mitglied_hinzugefuegt', 'mitglied_entfernt', 'mitglied_rolle_geaendert', 'verein_geloescht'
    ));
end $$;
