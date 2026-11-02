/**
 * Verein, Organisation oder Gewerbe löschen — Ablauf wie bei der Kontolöschung:
 * Dateien zuerst (wiederholbar), dann die Datenbank in einer Transaktion
 * (verein_loeschen, Migration 065). Scheitert ein Schritt, besteht der Verein noch.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { entferneDateien } from './kontoLoeschen'
import { rpcFehler, type Ziel } from './mitgliedschaft'

export type VereinLoeschErgebnis =
  | { ok: true; betroffene: { id: string; email: string | null; name: string | null }[] }
  | { ok: false; status: number; fehler: string }

const ALLGEMEIN = 'Der Verein konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'

export async function loescheVerein(
  ziel: Ziel,
  akteurId: string,
  service: SupabaseClient<Database>,
): Promise<VereinLoeschErgebnis> {
  if (ziel.recht === 'autor') return { ok: false, status: 403, fehler: 'Nur Verwalter können den Verein löschen.' }

  const zielArgs = {
    p_verein_id: ziel.verein_id ?? undefined,
    p_organisation_id: ziel.organisation_id ?? undefined,
  }

  const { data: pfade, error: pfadFehler } = await service.rpc('verein_dateipfade', zielArgs)
  if (pfadFehler) {
    console.error('[verein-loeschen] Dateipfade:', pfadFehler.message)
    return { ok: false, status: 500, fehler: ALLGEMEIN }
  }

  const dateiFehler = await entferneDateien(service, pfade ?? [])
  if (dateiFehler) {
    console.error('[verein-loeschen] Dateien:', dateiFehler)
    return { ok: false, status: 500, fehler: ALLGEMEIN }
  }

  const { data, error } = await service.rpc('verein_loeschen', { p_ausgefuehrt_von: akteurId, ...zielArgs })
  if (error) {
    const f = rpcFehler(error)
    return { ok: false, status: f.status, fehler: f.meldung }
  }

  return {
    ok: true,
    betroffene: (data ?? []).map(z => ({ id: z.mitglied_id, email: z.mitglied_email, name: z.mitglied_name })),
  }
}
