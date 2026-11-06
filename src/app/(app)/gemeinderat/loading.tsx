import { BeitragKarte, KopfBlau, Skelett } from '@/components/ui/Skelett'

const TABS = ['Beiträge', 'Räte & Fragen', 'Meine Fragen']

export default function Loading() {
  return (
    <Skelett>
      <KopfBlau titel="Gemeinderat" zurueck className="pb-3">
        <div className="flex gap-1.5 mt-3">
          {TABS.map((tab, i) => (
            <span
              key={tab}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${i === 0 ? 'bg-white text-primary-600' : 'bg-white/15 text-white/80'}`}
            >
              {tab}
            </span>
          ))}
        </div>
      </KopfBlau>
      <div className="p-4 space-y-4">
        {[0, 1, 2].map(i => <BeitragKarte key={i} band={false} />)}
      </div>
    </Skelett>
  )
}
