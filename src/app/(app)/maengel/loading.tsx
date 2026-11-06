import { KopfHell, MeldungKarte, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <KopfHell titel="Mängelmelder" untertitel="Schäden und Probleme melden" oben="pt-12" />
      <div className="p-4 space-y-3">
        {[0, 1, 2].map(i => <MeldungKarte key={i} />)}
      </div>
    </Skelett>
  )
}
