/**
 * Einziger Weg an die OneSignal-Zugangsdaten auf dem Server.
 *
 * In einer Testumgebung (Preview oder dorfly-dev, siehe istVersandGesperrt) wird
 * nie gepusht, auch wenn die Variablen gesetzt sind. Das ist kein Fehler: Aufrufer
 * behandeln 'testumgebung' als Erfolg ohne Versand. In der Produktion bleibt alles
 * wie vorher: fehlen dort die Variablen, ist das weiterhin ein Fehler ('fehlt').
 */

import { istVersandGesperrtAktuell } from '@/lib/previewUmgebung'

export type PushKonfig =
  | { status: 'an'; appId: string; apiKey: string }
  | { status: 'testumgebung' }
  | { status: 'fehlt' }

export const ONESIGNAL_NOTIFICATIONS_URL = 'https://onesignal.com/api/v1/notifications'

export function pushKonfig(
  werte: { appId: string | undefined; apiKey: string | undefined } = {
    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
    apiKey: process.env.ONESIGNAL_REST_API_KEY,
  },
  gesperrt: boolean = istVersandGesperrtAktuell(),
): PushKonfig {
  if (gesperrt) return { status: 'testumgebung' }
  if (!werte.appId || !werte.apiKey) return { status: 'fehlt' }
  return { status: 'an', appId: werte.appId, apiKey: werte.apiKey }
}

/** Kopfzeilen für die OneSignal-REST-API. */
export function oneSignalHeaders(konfig: { apiKey: string }): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Key ${konfig.apiKey}` }
}
