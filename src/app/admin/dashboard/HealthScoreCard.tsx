'use client'

import type { HealthComponents } from './types'

const COMPONENTS = [
  { key: 'mauScore',       label: 'MAU-Rate Bürger',         weight: '30%' },
  { key: 'retentionScore', label: '30-Tage-Retention',       weight: '20%' },
  { key: 'maengelScore',   label: 'Mängelmelder-Abschluss',  weight: '20%' },
  { key: 'prodAktivScore', label: 'Produzenten aktiv (30d)', weight: '20%' },
  { key: 'postsScore',     label: 'Posts / Woche',           weight: '10%' },
] as const

function scoreColor(score: number) {
  if (score >= 71) return 'bg-green-500'
  if (score >= 41) return 'bg-yellow-400'
  return 'bg-red-500'
}

function scoreTextColor(score: number) {
  if (score >= 71) return 'text-green-600'
  if (score >= 41) return 'text-yellow-500'
  return 'text-red-500'
}

function scoreLabel(score: number) {
  if (score >= 71) return 'Gut'
  if (score >= 41) return 'Mittel'
  return 'Kritisch'
}

export default function HealthScoreCard({
  score,
  components,
}: {
  score: number
  components: HealthComponents
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Community Health Score
          </h2>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-5xl font-bold ${scoreTextColor(score)}`}>{score}</span>
            <span className="text-gray-400 text-lg">/&nbsp;100</span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
              score >= 71 ? 'bg-green-100 text-green-700' :
              score >= 41 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-600'
            }`}>
              {scoreLabel(score)}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-3 mb-6">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${scoreColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {COMPONENTS.map(({ key, label, weight }) => {
          const val = components[key]
          return (
            <div key={key} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 font-medium">{weight}</span>
                <span className={`text-xs font-bold ${scoreTextColor(val)}`}>{val}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                <div
                  className={`h-1.5 rounded-full ${scoreColor(val)}`}
                  style={{ width: `${val}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 leading-tight">{label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
