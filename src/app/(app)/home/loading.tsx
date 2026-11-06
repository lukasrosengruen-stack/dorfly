import { Balken, Skelett } from '@/components/ui/Skelett'

export default function Loading() {
  return (
    <Skelett>
      <div className="bg-primary-500 px-6 pt-14 pb-6">
        <Balken className="h-2.5 w-24 bg-white/20" />
        <Balken className="h-8 w-44 mt-2.5 bg-white/30" />
        <p className="text-white/60 text-[13px] mt-1.5">Was möchtest du heute tun?</p>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3">
              <Balken className="w-[58px] h-[58px] rounded-[18px]" />
              <div>
                <Balken className="h-3.5 w-3/4" />
                <Balken className="h-2.5 w-1/2 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Skelett>
  )
}
