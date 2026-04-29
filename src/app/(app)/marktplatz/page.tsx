import { getGemeinde } from '@/lib/gemeinde'
import { PageHeader } from '@/components/ui'
import { ShoppingBag, Clock } from 'lucide-react'

export default async function MarktplatzPage() {
  const gemeinde = await getGemeinde()

  return (
    <div>
      <PageHeader
        gemeindeName={gemeinde?.name}
        title="Marktplatz"
        subtitle="Lokale Angebote & Gesuche"
      />

      <div className="p-4 mt-4">
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] p-8 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-primary-400" strokeWidth={1.5} />
          </div>
          <h2 className="font-black text-gray-900 text-lg uppercase tracking-wide mb-2">
            Demnächst verfügbar
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
            Der digitale Marktplatz ist in Planung. Hier können Sie bald lokale Angebote und Gesuche einstellen.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>In Kürze verfügbar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
