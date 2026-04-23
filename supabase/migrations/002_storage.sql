-- Storage Bucket für Medien (Fotos Mängelmelder, Post-Bilder)
insert into storage.buckets (id, name, public)
values ('dorfly-media', 'dorfly-media', true);

-- Nur angemeldete User dürfen hochladen
create policy "Authenticated upload" on storage.objects
  for insert with check (
    bucket_id = 'dorfly-media' and auth.role() = 'authenticated'
  );

-- Jeder kann lesen (public bucket)
create policy "Public read" on storage.objects
  for select using (bucket_id = 'dorfly-media');

-- Nur Uploader darf eigene Dateien löschen
create policy "Own delete" on storage.objects
  for delete using (
    bucket_id = 'dorfly-media' and auth.uid()::text = (storage.foldername(name))[1]
  );
