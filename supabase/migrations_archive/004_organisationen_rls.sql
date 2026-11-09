-- Fehlende RLS-Policies für organisationen
-- Die Tabelle hatte RLS aktiviert aber keine Policies → alle Operationen blockiert.

create policy "Organisationen lesen"
  on organisationen for select
  using (true);

create policy "Gewerbe anlegen"
  on organisationen for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'gewerbe'
    )
  );

create policy "Gewerbe bearbeiten"
  on organisationen for update
  using (
    profile_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'gewerbe'
    )
  );
