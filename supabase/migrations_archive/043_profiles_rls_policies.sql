-- RLS-Policies auf profiles verschaerft.
-- Die alte Policy "profiles_public_lesen" (using true) gab jedem eingeloggten
-- Nutzer alle Profile aller Gemeinden frei. Sie ist entfernt.
-- Fremde Profildaten werden jetzt ueber die View profiles_public gelesen.
-- Die Funktionen brauchen row_security = off, sonst entsteht Rekursion,
-- weil eine Policy auf profiles sonst profiles lesen wuerde.
-- Am 09.07.2026 manuell auf dorfly-production ausgefuehrt, hier nachgetragen.

create or replace function public.current_gemeinde_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select gemeinde_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_verwaltung()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('verwaltung'::user_role, 'super_admin'::user_role)
  )
$$;

drop policy if exists "profiles_public_lesen" on public.profiles;

create policy "profiles_select_verwaltung"
  on public.profiles for select to authenticated
  using (
    public.is_verwaltung()
    and gemeinde_id = public.current_gemeinde_id()
  );
