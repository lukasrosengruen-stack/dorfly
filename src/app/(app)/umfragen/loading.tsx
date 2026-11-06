import { Balken, KopfBlau, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <KopfBlau titel="Umfragen" untertitel="Deine Meinung zählt" zurueck />
      <div className="p-4 space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-primary-500 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <Balken className="h-5 w-16 rounded-full" />
              <Balken className="h-3 w-20" />
            </div>
            <Balken className="h-4 w-3/4" />
            <Balken className="h-3 w-full mt-3" />
          </div>
        ))}
      </div>
    </Skelett>
  )
}
