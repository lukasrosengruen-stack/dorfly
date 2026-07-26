import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getVereinDetail } from '@/lib/verein'
import VereinProfil from './VereinProfil'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('vereine').select('verein_name').eq('id', id).single()
  return { title: data ? `${data.verein_name} – Dorfly` : 'Verein – Dorfly' }
}

export default async function VereinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getVereinDetail(supabase, id, user?.id ?? null)
  if (!detail) notFound()

  return (
    <VereinProfil
      verein={detail.verein}
      posts={detail.posts}
      istAbonniert={detail.istAbonniert}
      abonnentenAnzahl={detail.abonnentenAnzahl}
    />
  )
}
