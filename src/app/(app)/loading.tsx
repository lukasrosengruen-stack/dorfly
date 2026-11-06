// Skelett beim Seitenwechsel innerhalb der App: Die Navigation bleibt stehen, statt
// dass der Vollbild-Ladebildschirm aus src/app/loading.tsx alles überdeckt.
export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Seite wird geladen</span>

      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="bg-primary-500 px-4 pt-safe-header pb-4">
          <div className="h-2.5 w-20 rounded bg-white/20 mb-2" />
          <div className="h-6 w-44 rounded bg-white/30" />
        </div>

        <div className="p-4 space-y-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-gray-100" />
                <div className="h-2.5 w-full rounded bg-gray-100" />
                <div className="h-2.5 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
