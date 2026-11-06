import { KopfBlau, Skelett, VerzeichnisKarte } from '@/components/ui/Skelett'

// Rückfall für Seiten ohne eigenes Skelett: Die Navigation bleibt stehen, statt
// dass der Vollbild-Ladebildschirm aus src/app/loading.tsx alles überdeckt.
export default function Loading() {
  return (
    <Skelett>
      <KopfBlau />
      <div className="p-4 space-y-3">
        {[0, 1, 2, 3, 4].map(i => <VerzeichnisKarte key={i} />)}
      </div>
    </Skelett>
  )
}
