/**
 * Absender eines Vereinsbeitrags ist der Verein, nicht die Person.
 *
 * Feed, Kalender und Share-Seite zeigen den Vereinsnamen bisher aus
 * profiles.verein_name des Autors. Seit Migration 065 kann ein Verein mehrere
 * Autoren haben und Beiträge überleben gelöschte Konten (author_id = null).
 * Deshalb kommt der Name jetzt über posts.org_id aus vereine.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

interface AbsenderPost {
  channel: string
  org_id: string | null
}

export interface AutorAnzeige {
  display_name?: string | null
  verein_name?: string | null
  role?: string | null
  avatar_url?: string | null
}

export interface AbsenderName {
  name: string
  typ: 'verein' | 'organisation' | 'gewerbe'
}

export function vereinsIds(posts: AbsenderPost[]): string[] {
  return [...new Set(posts.filter(p => (p.channel === 'verein' || p.channel === 'gewerbe') && p.org_id).map(p => p.org_id!))]
}

export async function ladeVereinsnamen(
  client: SupabaseClient<Database>,
  posts: AbsenderPost[],
): Promise<Map<string, AbsenderName>> {
  const vereinIds = vereinsIds(posts.filter(p => p.channel === 'verein'))
  const gewerbeIds = vereinsIds(posts.filter(p => p.channel === 'gewerbe'))
  const namen = new Map<string, AbsenderName>()
  const [vereine, betriebe] = await Promise.all([
    vereinIds.length > 0
      ? client.from('vereine').select('id, verein_name, typ').in('id', vereinIds)
      : Promise.resolve({ data: [] }),
    gewerbeIds.length > 0
      ? client.from('organisationen').select('id, name').in('id', gewerbeIds)
      : Promise.resolve({ data: [] }),
  ])
  for (const v of vereine.data ?? []) {
    namen.set(v.id, { name: v.verein_name, typ: v.typ === 'organisation' ? 'organisation' : 'verein' })
  }
  for (const g of betriebe.data ?? []) namen.set(g.id, { name: g.name, typ: 'gewerbe' })
  return namen
}

export function mitVereinsabsender<A extends AutorAnzeige>(
  post: AbsenderPost,
  autor: A | null,
  namen: Map<string, AbsenderName>,
): A | AutorAnzeige | null {
  if ((post.channel !== 'verein' && post.channel !== 'gewerbe') || !post.org_id) return autor
  const eintrag = namen.get(post.org_id) ?? null
  if (post.channel === 'gewerbe') {
    // Mit Autor bleibt alles wie es ist: ein verein_name würde im Feed ein Vereins-Badge erzeugen.
    if (autor) return autor
    return eintrag ? { display_name: eintrag.name, verein_name: null, role: 'gewerbe', avatar_url: null } : null
  }
  if (!autor) return eintrag ? { display_name: null, verein_name: eintrag.name, role: eintrag.typ, avatar_url: null } : null
  return { ...autor, verein_name: eintrag?.name ?? null }
}
