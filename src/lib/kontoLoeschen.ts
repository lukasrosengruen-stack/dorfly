/**
 * Kontolöschung — Ablauf für /api/auth/loeschen.
 *
 * Reihenfolge ist Absicht: Alles, was sich nicht in die Datenbank-Transaktion
 * einbinden lässt (OneSignal, Storage), läuft VORHER und ist wiederholbar.
 * Erst ganz am Ende löscht konto_loeschen() alle Datenbankzeilen samt
 * auth.users in einer Transaktion (Migration 064). Scheitert ein Schritt, bricht
 * der Ablauf ab, und das Konto besteht noch — der Nutzer kann es erneut versuchen.
 *
 * Schlimmster Fall bei einem Abbruch: Bilder sind schon weg, die Inhalte noch da.
 * Umgekehrt (Inhalte weg, Bilder öffentlich abrufbar) kann es nicht passieren.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export const MEDIA_BUCKET = 'dorfly-media'

// Storage-API nimmt höchstens 1000 Pfade pro remove()-Aufruf
const STORAGE_BATCH = 1000

export type LoeschSchritt = 'onesignal' | 'dateien' | 'datenbank'

export type LoeschErgebnis =
  | { ok: true; dateien: number }
  | { ok: false; schritt: LoeschSchritt; fehler: string }

export interface OneSignalKonfig {
  appId: string
  apiKey: string
}

interface Abhaengigkeiten {
  service: SupabaseClient<Database>
  /** null, wenn die Umgebungsvariablen fehlen — dann wird nicht gelöscht. */
  oneSignal: OneSignalKonfig | null
  fetch?: typeof fetch
}

/**
 * Löscht den OneSignal-Nutzer mit der Supabase-User-ID als external_id.
 * 404 heißt: Der Nutzer hatte Push nie aktiviert — das zählt als Erfolg.
 */
export async function loescheOneSignalNutzer(
  userId: string,
  konfig: OneSignalKonfig,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const url = `https://api.onesignal.com/apps/${konfig.appId}/users/by/external_id/${encodeURIComponent(userId)}`
  try {
    const res = await fetchFn(url, {
      method: 'DELETE',
      headers: { Authorization: `Key ${konfig.apiKey}` },
    })
    if (res.ok || res.status === 404) return null
    return `OneSignal antwortete mit ${res.status}`
  } catch (e) {
    return e instanceof Error ? e.message : 'OneSignal nicht erreichbar'
  }
}

export async function loescheKonto(userId: string, deps: Abhaengigkeiten): Promise<LoeschErgebnis> {
  const { service } = deps

  // 1. OneSignal
  if (!deps.oneSignal) {
    return { ok: false, schritt: 'onesignal', fehler: 'OneSignal-Umgebungsvariablen fehlen' }
  }
  const oneSignalFehler = await loescheOneSignalNutzer(userId, deps.oneSignal, deps.fetch)
  if (oneSignalFehler) return { ok: false, schritt: 'onesignal', fehler: oneSignalFehler }

  // 2. Dateien im Storage
  const { data: pfade, error: pfadFehler } = await service.rpc('konto_dateipfade', { p_user_id: userId })
  if (pfadFehler) return { ok: false, schritt: 'dateien', fehler: pfadFehler.message }

  const liste = pfade ?? []
  for (let i = 0; i < liste.length; i += STORAGE_BATCH) {
    const { error } = await service.storage.from(MEDIA_BUCKET).remove(liste.slice(i, i + STORAGE_BATCH))
    if (error) return { ok: false, schritt: 'dateien', fehler: error.message }
  }

  // 3. Datenbank — eine Transaktion, ganz oder gar nicht
  const { error: dbFehler } = await service.rpc('konto_loeschen', { p_user_id: userId })
  if (dbFehler) return { ok: false, schritt: 'datenbank', fehler: dbFehler.message }

  return { ok: true, dateien: liste.length }
}
