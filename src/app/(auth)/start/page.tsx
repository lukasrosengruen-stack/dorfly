import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import GemeindeAuswahl from './_components/GemeindeAuswahl'

export const metadata: Metadata = { title: 'Gemeinde auswählen – Dorfly' }

export default async function StartPage() {
  const supabase = await createClient()
  const { data: gemeinden } = await supabase
    .from('gemeinden')
    .select('id, name, slug')
    .eq('ist_oeffentlich', true)
    .order('name', { ascending: true })

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-primary-100 flex items-center justify-center px-4 pb-4 pt-20">
      <GemeindeAuswahl gemeinden={gemeinden ?? []} rootDomain={rootDomain} />
    </div>
  )
}
