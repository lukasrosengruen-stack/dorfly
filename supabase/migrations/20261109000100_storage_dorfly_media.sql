-- Storage: Bucket dorfly-media und die drei Policies auf storage.objects,
-- exakt wie in Produktion (hzptnylfdfibijkgtfhf, Stand 2026-11-09).
-- Verbesserungen kommen bewusst als eigene Migration danach.
--
-- GRANTs: keine noetig. storage.buckets und storage.objects gehoeren zum von
-- Supabase verwalteten Schema storage, die Rollen-Grants setzt die Plattform.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
values ('dorfly-media', 'dorfly-media', true, null, null, false);

create policy "Authenticated upload" on storage.objects
  for insert
  with check ((bucket_id = 'dorfly-media'::text) and (auth.role() = 'authenticated'::text));

create policy "Public read" on storage.objects
  for select
  using ((bucket_id = 'dorfly-media'::text));

create policy "Own delete" on storage.objects
  for delete
  using ((bucket_id = 'dorfly-media'::text) and ((auth.uid())::text = (storage.foldername(name))[1]));
