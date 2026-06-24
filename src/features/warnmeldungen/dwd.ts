// src/features/warnmeldungen/dwd.ts
import type { DwdAlert, DwdAlertsResponse } from './types'

export function filterActiveAlerts(alerts: DwdAlert[]): DwdAlert[] {
  return alerts.filter((a) => a.status === 'actual')
}

export function buildPostContent(alert: DwdAlert): { titel: string; inhalt: string } {
  const titel = alert.headline_de
  const parts: string[] = []
  if (alert.description_de) parts.push(alert.description_de)
  if (alert.expires) {
    const date = new Date(alert.expires)
    parts.push(`Gültig bis: ${date.toLocaleString('de-DE')}`)
  }
  if (alert.instruction_de) parts.push(`Verhaltenshinweis: ${alert.instruction_de}`)
  return { titel, inhalt: parts.join('\n\n') || titel }
}

export async function fetchDwdAlerts(warncellId: string): Promise<DwdAlert[]> {
  const url = `https://api.brightsky.dev/alerts?warn_cell_id=${encodeURIComponent(warncellId)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`DWD API error: ${res.status}`)
  const data: DwdAlertsResponse = await res.json()
  return data.alerts ?? []
}
