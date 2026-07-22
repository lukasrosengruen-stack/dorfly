// Extrahiert den Objekt-Pfad aus einer Supabase-Storage-Public-URL, z.B.
// "https://xyz.supabase.co/storage/v1/object/public/dorfly-media/maengel/123.jpg"
// -> "maengel/123.jpg". Gibt null zurück, wenn die URL nicht zum Bucket passt.
export function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}
