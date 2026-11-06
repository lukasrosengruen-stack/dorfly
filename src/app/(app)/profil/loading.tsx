import { Balken, KopfHell, Skelett, ZeilenKarte } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <KopfHell titel="Profil" zurueck />
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center">
          <Balken className="w-20 h-20 rounded-full mb-3" />
          <Balken className="h-5 w-40" />
          <Balken className="h-6 w-24 mt-2 rounded-full" />
        </div>
        <ZeilenKarte ueberschrift="Persönliche Daten" zeilen={4} />
        <ZeilenKarte ueberschrift="Benachrichtigungen" zeilen={2} />
      </div>
    </Skelett>
  )
}
