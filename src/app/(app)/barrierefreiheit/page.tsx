import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Accessibility } from 'lucide-react'

export const metadata: Metadata = { title: 'Barrierefreiheit – Dorfly' }

export default async function BarrierefreiheitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinden(name, subdomain)')
    .eq('id', user.id)
    .single()

  const gemeindeName = (profile?.gemeinden as { name: string; subdomain: string } | null)?.name ?? 'Ihrer Gemeinde'
  const gemeindeUrl = typeof window === 'undefined'
    ? `https://${(profile?.gemeinden as { name: string; subdomain: string } | null)?.subdomain ?? ''}.dorfly.app`
    : window.location.origin

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/profil" className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Zurück zum Profil">
          <ChevronLeft className="w-5 h-5 text-gray-500" aria-hidden="true" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Barrierefreiheit</h1>
      </div>

      <div className="p-4 space-y-4 pb-12">

        {/* Intro */}
        <div className="bg-primary-50 rounded-2xl p-4 flex items-start gap-3">
          <Accessibility className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-primary-800 leading-relaxed">
            Diese App wurde nach <strong>WCAG 2.2 AA</strong>, BITV 2.0 und EN 301 549 entwickelt und ist damit mit den Anforderungen des Barrierefreiheitsstärkungsgesetzes (BFSG) weitgehend vereinbar.
          </p>
        </div>

        {/* Erklärung */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5">
          <section aria-labelledby="erklaerung-titel">
            <h2 id="erklaerung-titel" className="font-bold text-gray-900 mb-2">
              Erklärung zur Barrierefreiheit
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Diese Erklärung gilt für das Bürgerportal der Gemeinde <strong>{gemeindeName}</strong>, bereitgestellt durch die Dorfly-Plattform.
            </p>
          </section>

          <hr className="border-gray-100" />

          <section aria-labelledby="vereinbarkeit-titel">
            <h2 id="vereinbarkeit-titel" className="font-semibold text-gray-900 mb-2 text-sm">
              Vereinbarkeit mit den Anforderungen
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Diese Anwendung ist mit den Anforderungen der BITV 2.0 und WCAG 2.2 auf Konformitätsstufe AA <strong>weitgehend vereinbar</strong>. Folgende Bereiche sind noch nicht vollständig konform:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 shrink-0">–</span>
                <span>Alt-Text für nutzergenerierte Fotos im Mängelmelder (Kriterium 1.1.1): Nutzer können optionalen Beschreibungstext ergänzen, ist aber nicht verpflichtend.</span>
              </li>
            </ul>
          </section>

          <hr className="border-gray-100" />

          <section aria-labelledby="feedback-titel">
            <h2 id="feedback-titel" className="font-semibold text-gray-900 mb-2 text-sm">
              Feedback & Kontakt
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Wenn Sie Barrieren bemerken oder Inhalte nicht zugänglich sind, wenden Sie sich bitte an die Gemeindeverwaltung {gemeindeName}. Wir bemühen uns um eine Antwort innerhalb von <strong>4 Wochen</strong>.
            </p>
          </section>

          <hr className="border-gray-100" />

          <section aria-labelledby="schlichtung-titel">
            <h2 id="schlichtung-titel" className="font-semibold text-gray-900 mb-2 text-sm">
              Schlichtungsverfahren
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Bei unbefriedigender Antwort können Sie die Schlichtungsstelle nach § 16 BGG einschalten:
            </p>
            <address className="mt-2 text-sm text-gray-600 not-italic leading-relaxed">
              Schlichtungsstelle nach § 16 BGG<br />
              Mauerstraße 53, 10117 Berlin<br />
              <a href="mailto:info@schlichtungsstelle-bgg.de" className="text-primary-500 underline">
                info@schlichtungsstelle-bgg.de
              </a>
            </address>
          </section>

          <hr className="border-gray-100" />

          <p className="text-xs text-gray-400">
            Stand: Mai 2026 · Erstellt durch interne Prüfung nach WCAG 2.2 AA
          </p>
        </div>
      </div>
    </div>
  )
}
