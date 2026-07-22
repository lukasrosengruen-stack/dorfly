alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version      text,
  add column if not exists age_confirmed_at   timestamptz;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;
