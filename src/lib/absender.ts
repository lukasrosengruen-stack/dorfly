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

export function vereinsIds(posts: AbsenderPost[]): string[] {
  return [...new Set(posts.filter(p => p.channel === 'verein' && p.org_id).map(p => p.org_id!))]
}

export async function ladeVereinsnamen(
  client: SupabaseClient<Database>,
  posts: AbsenderPost[],
): Promise<Map<string, string>> {
  const ids = vereinsIds(posts)
  if (ids.length === 0) return new Map()
  const { data } = await client.from('vereine').select('id, verein_name').in('id', ids)
  return new Map((data ?? []).map(v => [v.id, v.verein_name]))
}

export function mitVereinsabsender<A extends AutorAnzeige>(
  post: AbsenderPost,
  autor: A | null,
  namen: Map<string, string>,
): A | AutorAnzeige | null {
  if (post.channel !== 'verein' || !post.org_id) return autor
  const name = namen.get(post.org_id) ?? null
  if (!autor) return name ? { display_name: null, verein_name: name, role: 'verein', avatar_url: null } : null
  return { ...autor, verein_name: name }
}
