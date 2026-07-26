import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGewerbeDetail } from '@/lib/gewerbe'
import GewerbeProfil from './GewerbeProfil'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('organisationen').select('name').eq('id', id).eq('typ', 'gewerbe').single()
  return { title: data ? `${data.name} – Dorfly` : 'Lokales Angebot – Dorfly' }
}

export default async function GewerbeProfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getGewerbeDetail(supabase, id, user?.id ?? null)
  if (!detail) notFound()

  return (
    <GewerbeProfil
      betrieb={detail.betrieb}
      posts={detail.posts}
      istAbonniert={detail.istAbonniert}
      abonnentenAnzahl={detail.abonnentenAnzahl}
      istEigentümer={false}
    />
  )
}
