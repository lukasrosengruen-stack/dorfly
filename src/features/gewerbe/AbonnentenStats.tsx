interface AbonnentenStatsProps {
  gesamt: number
  letzter7Tage: number
  letzter30Tage: number
}

export function AbonnentenStats({ gesamt, letzter7Tage, letzter30Tage }: AbonnentenStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatBox label="Gesamt" value={gesamt} />
      <StatBox label="Letzte 7 Tage" value={letzter7Tage} highlight />
      <StatBox label="Letzte 30 Tage" value={letzter30Tage} />
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] p-4 text-center">
      <p className={`text-2xl font-black ${highlight ? 'text-orange-500' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}
