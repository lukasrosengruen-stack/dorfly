-- Erweitert die RLS-Policy "Posts erstellen" um die Rolle 'gewerbe'.
-- Hintergrund: /api/gewerbe/post nutzt createClient() (authenticated),
-- daher greift RLS. Die ursprüngliche Policy (001_initial_schema.sql)
-- kannte 'gewerbe' noch nicht.

drop policy if exists "Posts erstellen" on public.posts;

create policy "Posts erstellen" on public.posts for insert
  with check (
    auth.uid() = author_id and
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('organisation', 'verwaltung', 'super_admin', 'gewerbe')
    )
  );
