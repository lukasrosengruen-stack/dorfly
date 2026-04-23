import { ShoppingBag, Clock } from 'lucide-react'

export default function MarktplatzPage() {
  return (
    <div>
      <div className="bg-primary-500 px-4 pt-12 pb-5">
        <p className="text-primary-200 text-xs font-bold tracking-[0.2em] uppercase mb-1">Gemeinde Ehningen</p>
        <h1 className="text-white font-black text-2xl tracking-wide uppercase">Marktplatz</h1>
        <p className="text-primary-200 text-sm mt-1">Lokale Angebote & Gesuche</p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center mt-4">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-primary-500" />
          </div>
          <h2 className="font-black text-gray-900 text-lg uppercase tracking-wide mb-2">
            Demnächst verfügbar
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
            Der digitale Marktplatz für Ehningen ist in Planung. Hier können Sie bald lokale Angebote und Gesuche einstellen.
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
