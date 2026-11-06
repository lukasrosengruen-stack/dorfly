import { Balken, Skelett } from '@/components/ui/Skelett'

function Abschnitt({ zeilen }: { zeilen: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <Balken className="h-3.5 w-28 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: zeilen }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <Balken className="w-9 h-9 rounded-xl shrink-0" />
            <Balken className="h-3 flex-1" />
            <Balken className="w-5 h-5 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <Skelett>
      <div className="bg-primary-500 px-4 pt-safe-header pb-5">
        <Balken className="h-3 w-24 mb-2 bg-white/20" />
        <p className="text-white font-black text-2xl">Abfallkalender · Einstellungen</p>
      </div>
      <div className="px-4 py-5 space-y-5">
        <Abschnitt zeilen={4} />
        <Abschnitt zeilen={2} />
      </div>
    </Skelett>
  )
}
