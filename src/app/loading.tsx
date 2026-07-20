import Image from 'next/image'

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-primary-500 flex flex-col items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-6">
        <Image
          src="/icons/icon-512.png"
          alt="Dorfly"
          width={96}
          height={96}
          priority
          className="rounded-2xl shadow-lg"
        />

        <div className="mt-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-white rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>

        <p className="text-white/50 text-xs tracking-widest uppercase absolute bottom-10">
          powered by dorfly
        </p>
      </div>
    </div>
  )
}
