/**
 * Gemeinde-Hilfsfunktionen
 *
 * getGemeindeSlug()  – liest den Slug aus dem x-gemeinde-slug Header (gesetzt von middleware.ts)
 * getGemeinde()      – lädt das vollständige Gemeinde-Objekt aus der DB (einmal pro Request, gecacht)
 */

import { headers } from 'next/headers'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export type Gemeinde = Database['public']['Tables']['gemeinden']['Row']

/**
 * Gibt den Gemeinde-Slug für den aktuellen Request zurück.
 * Der Slug wird von middleware.ts als x-gemeinde-slug Header gesetzt.
 * Fallback: NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG (für lokale Entwicklung).
 */
export async function getGemeindeSlug(): Promise<string> {
  const h = await headers()
  return h.get('x-gemeinde-slug') ?? process.env.NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG ?? 'ehningen'
}

/**
 * Lädt das vollständige Gemeinde-Objekt aus der Datenbank.
 * Wird dank React cache() nur einmal pro Request ausgeführt,
 * egal wie viele Server Components es aufrufen.
 *
 * @returns Gemeinde-Objekt oder null wenn nicht gefunden
 */
export const getGemeinde = cache(async (): Promise<Gemeinde | null> => {
  const slug = await getGemeindeSlug()
  const supabase = await createClient()

  const { data } = await supabase
    .from('gemeinden')
    .select('*')
    .eq('slug', slug)
    .single()

  return data
})
