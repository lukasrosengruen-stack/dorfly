import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GemeindeAuswahl from './_components/GemeindeAuswahl'

export const metadata: Metadata = { title: 'Gemeinde auswählen – Dorfly' }

// Die Session steckt im Cookie — ohne das hier würde Next die Seite statisch
// ausliefern und die Weiterleitung nie greifen.
export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const supabase = await createClient()
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

  // Die native App startet laut capacitor.config.ts jeden Kaltstart auf
  // dorfly.de/start. Ohne diese Prüfung landete auch ein angemeldeter Nutzer
  // jedes Mal auf der Gemeindeauswahl und danach auf dem Login-Formular —
  // obwohl seine Session die ganze Zeit gültig war.
  //
  // Kein Bypass nötig: ein Profil ist über gemeinde_id fest an genau eine
  // Gemeinde gebunden, ein Wechsel ist nicht vorgesehen. Wer die Auswahl
  // braucht, hat keine Session — Gäste und Abgemeldete sehen sie unverändert.
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profil } = await supabase
      .from('profiles')
      .select('gemeinden(slug)')
      .eq('id', user.id)
      .single()

    const slug = (profil?.gemeinden as { slug?: string } | null)?.slug

    // Das Profil ist die verlässlichere Quelle als localStorage: serverseitig
    // gelesen, kann nicht veralten und überlebt ein geleertes Browserdatum.
    if (slug) {
      redirect(`https://${slug}.${rootDomain}/feed`)
    }
  }

  const { data: gemeinden } = await supabase
    .from('gemeinden')
    .select('id, name, slug')
    .eq('ist_oeffentlich', true)
    .order('name', { ascending: true })

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-primary-100 flex items-center justify-center px-4 pb-4 pt-20">
      <GemeindeAuswahl gemeinden={gemeinden ?? []} rootDomain={rootDomain} />
    </div>
  )
}
