import { Balken, BeitragKarte, KopfBlau, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <KopfBlau zurueck />
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] p-5">
          <div className="flex items-start gap-4">
            <Balken className="w-20 h-20 rounded-2xl shrink-0" />
            <div className="flex-1 min-w-0">
              <Balken className="h-5 w-3/4" />
              <Balken className="h-2.5 w-1/3 mt-2" />
              <Balken className="h-2.5 w-1/2 mt-3" />
            </div>
          </div>
          <Balken className="h-3 w-full mt-4" />
          <Balken className="h-3 w-5/6 mt-2" />
          <Balken className="h-11 w-full mt-4 rounded-xl" />
        </div>
        <BeitragKarte band={false} />
        <BeitragKarte band={false} />
      </div>
    </Skelett>
  )
}
