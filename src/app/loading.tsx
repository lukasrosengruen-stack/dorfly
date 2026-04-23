export default function Loading() {
  return (
    <div className="fixed inset-0 bg-primary-500 flex flex-col items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-6">
        {/* Gemeinde-Wappen Platzhalter */}
        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-1 border-4 border-primary-500 rounded-full flex items-center justify-center">
              <span className="text-primary-500 font-black text-lg">E</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-white/70 text-xs font-semibold tracking-[0.3em] uppercase mb-1">Gemeinde</p>
          <h1 className="text-white font-black text-3xl tracking-wider uppercase">EHNINGEN</h1>
        </div>

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
