-- profiles_public: schmale, gemeinde-gefilterte Sicht auf profiles.
-- Enthaelt bewusst kein email, kein phone, kein phone_verified.
-- Am 09.07.2026 manuell auf dorfly-production ausgefuehrt, hier nachgetragen.

create or replace function public.current_gemeinde_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gemeinde_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_verwaltung()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('verwaltung'::user_role, 'super_admin'::user_role)
  )
$$;

create or replace view public.profiles_public
with (security_invoker = off)
as
  select
    id, gemeinde_id, display_name, verein_name, role, avatar_url,
    fraktion, ueber_mich, kontakt_email,
    social_x, social_facebook, social_instagram, social_tiktok
  from public.profiles
  where role <> 'buerger'::user_role
    and gemeinde_id = public.current_gemeinde_id();

revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to authenticated;
grant execute on function public.current_gemeinde_id() to authenticated;
grant execute on function public.is_verwaltung() to authenticated;
