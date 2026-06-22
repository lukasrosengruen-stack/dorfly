// src/features/warnmeldungen/types.ts

export type WarnSeverity = 1 | 2 | 3 | 4

export const SEVERITY_LABEL: Record<WarnSeverity, string> = {
  1: 'Hinweis',
  2: 'Warnung',
  3: 'Starke Warnung',
  4: 'Extreme Warnung',
}

export const SEVERITY_COLOR: Record<WarnSeverity, string> = {
  1: '#f59e0b',
  2: '#f97316',
  3: '#dc2626',
  4: '#7f1d1d',
}

export const SEVERITY_BG: Record<WarnSeverity, string> = {
  1: 'rgba(245,158,11,0.12)',
  2: 'rgba(249,115,22,0.12)',
  3: 'rgba(220,38,38,0.12)',
  4: 'rgba(127,29,29,0.12)',
}

export interface DwdAlert {
  id: string
  event: string
  headline: string
  description: string | null
  instruction: string | null
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme'
  status: string
  message_type: string
  effective: string
  expires: string | null
  warn_cell_ids: string[]
}

export interface DwdAlertsResponse {
  alerts: DwdAlert[]
}

export const SEVERITY_MAP: Record<DwdAlert['severity'], WarnSeverity> = {
  Minor: 1,
  Moderate: 2,
  Severe: 3,
  Extreme: 4,
}
