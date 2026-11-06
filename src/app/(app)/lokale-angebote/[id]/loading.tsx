import { Balken, BeitragKarte, Skelett, ZeilenKarte } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <div className="bg-primary-500 px-4 pt-safe-header pb-6">
        <Balken className="h-4 w-16 mb-3 bg-white/20" />
        <div className="flex items-center gap-4">
          <Balken className="w-16 h-16 rounded-2xl shrink-0 bg-white/20" />
          <div className="flex-1 min-w-0">
            <Balken className="h-5 w-3/4 bg-white/30" />
            <Balken className="h-3 w-1/3 mt-2 bg-white/20" />
            <Balken className="h-2.5 w-1/2 mt-2 bg-white/20" />
          </div>
        </div>
        <Balken className="h-11 w-full mt-4 rounded-xl bg-white/20" />
      </div>
      <div className="p-4 space-y-4">
        <ZeilenKarte />
        <BeitragKarte band={false} />
      </div>
    </Skelett>
  )
}
