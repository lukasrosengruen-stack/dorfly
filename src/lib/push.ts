/**
 * Push-Benachrichtigungen an einzelne Nutzer (OneSignal).
 *
 * Die Zustellung laeuft ueber `external_id` — die Supabase-User-ID, die der
 * Client beim Login als OneSignal-Alias setzt. Wer Push nie aktiviert hat,
 * besitzt unter dieser ID kein Abo; OneSignal verwirft die Nachricht dann
 * still. Ein eigener Schalter ist deshalb nicht noetig.
 */

import { ONESIGNAL_NOTIFICATIONS_URL, oneSignalHeaders, pushKonfig } from '@/lib/pushKonfig'

const ROOT_DOMAIN =process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

interface PushParams {
  /** Supabase-User-ID des Empfaengers. */
  userId: string
  titel: string
  nachricht: string
  /** App-Pfad, auf den die Benachrichtigung fuehrt, z.B. '/maengel'. */
  pfad: string
  gemeindeSlug: string
}

/**
 * Schickt eine Push an genau einen Nutzer.
 *
 * Wirft nicht: Aufrufer verschicken Push als Nebenwirkung einer bereits
 * gespeicherten Aenderung — ein Zustellproblem darf den Hauptvorgang nicht
 * scheitern lassen. Der Rueckgabewert sagt, ob OneSignal angenommen hat.
 */
export async function sendePushAnNutzer(params: PushParams): Promise<boolean> {
  const konfig = pushKonfig()
  if (konfig.status === 'testumgebung') {
    console.info('[push] Testumgebung: Push nicht verschickt')
    return false
  }
  if (konfig.status === 'fehlt') {
    console.error('[push] OneSignal-Umgebungsvariablen fehlen — Push übersprungen')
    return false
  }

  const pfad = params.pfad.startsWith('/') ? params.pfad : `/${params.pfad}`

  try {
    const res = await fetch(ONESIGNAL_NOTIFICATIONS_URL, {
      method: 'POST',
      headers: oneSignalHeaders(konfig),
      body: JSON.stringify({
        app_id: konfig.appId,
        include_aliases: { external_id: [params.userId] },
        target_channel: 'push',
        headings: { de: params.titel, en: params.titel },
        contents: { de: params.nachricht, en: params.nachricht },
        web_url: `https://${params.gemeindeSlug}.${ROOT_DOMAIN}${pfad}`,
        data: { pfad },
      }),
    })

    if (!res.ok) {
      console.error('[push] OneSignal hat abgelehnt', { status: res.status, body: await res.text() })
      return false
    }
    return true
  } catch (e) {
    console.error('[push] Versand fehlgeschlagen', e)
    return false
  }
}
