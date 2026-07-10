-- 046_posts_insert_tenant_check.sql
-- Die INSERT-Policy prüfte nur author_id und die Rolle, nicht die Gemeinde.
-- Ein Nutzer mit zugelassener Rolle konnte per direktem REST-Call mit dem
-- Anon-Key einen sofort veröffentlichten Post in jede beliebige Gemeinde
-- schreiben. Die App war kein Angriffspfad, die Datenbank schon.

drop policy if exists "Posts erstellen" on public.posts;

create policy "Posts erstellen"
  on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and gemeinde_id = public.current_gemeinde_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in (
          'organisation'::user_role,
          'verwaltung'::user_role,
          'super_admin'::user_role,
          'gewerbe'::user_role
        )
    )
  );
