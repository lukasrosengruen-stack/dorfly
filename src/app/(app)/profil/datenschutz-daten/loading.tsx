import { KopfHell, Skelett, ZeilenKarte } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <KopfHell titel="Datenschutz & Daten" zurueck />
      <div className="p-4 space-y-4">
        <ZeilenKarte zeilen={2} />
        <ZeilenKarte zeilen={1} />
      </div>
    </Skelett>
  )
}
