import { Balken, KopfHell, MeldungKarte, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      {/* Der Titel hängt von der Gemeinde ab, deshalb hier ein Platzhalter */}
      <KopfHell untertitel="Stelle deine Fragen direkt an die Verwaltung">
        <div className="flex gap-2 mt-3">
          <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-primary-500 text-white">Alle Fragen</span>
          <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600">Meine Fragen</span>
        </div>
      </KopfHell>
      <div className="p-4 space-y-3">
        <Balken className="h-14 w-full rounded-2xl" />
        {[0, 1, 2].map(i => <MeldungKarte key={i} />)}
      </div>
    </Skelett>
  )
}
