import { Balken, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <div className="bg-red-600 px-6 pt-safe-header pb-6">
        <Balken className="h-4 w-16 mb-2 -mt-1 bg-white/20" />
        <Balken className="h-2.5 w-24 bg-white/20" />
        <p className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">Warnmeldungen</p>
        <Balken className="h-3 w-40 mt-2.5 bg-white/20" />
      </div>
      <div className="px-4 py-4 space-y-3">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-[18px] p-4 shadow-[0_2px_14px_rgba(15,45,107,0.08)]">
            <Balken className="h-4 w-2/3" />
            <Balken className="h-3 w-full mt-3" />
            <Balken className="h-3 w-5/6 mt-2" />
          </div>
        ))}
      </div>
    </Skelett>
  )
}
