import { headers } from 'next/headers'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export type Gemeinde = Database['public']['Tables']['gemeinden']['Row']

export async function getGemeindeSlug(): Promise<string | null> {
  const h = await headers()
  return h.get('x-gemeinde-slug')
}

export const getGemeinde = cache(async (): Promise<Gemeinde | null> => {
  const slug = await getGemeindeSlug()
  if (slug === null) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('gemeinden')
    .select('*')
    .eq('slug', slug)
    .single()

  return data
})
