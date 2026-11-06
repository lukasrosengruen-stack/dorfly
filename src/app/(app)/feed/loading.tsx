import { BeitragKarte, KopfBlau, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <KopfBlau titel="Neuigkeiten" aktion />
      <div className="p-4 space-y-4">
        {[0, 1, 2].map(i => <BeitragKarte key={i} />)}
      </div>
    </Skelett>
  )
}
