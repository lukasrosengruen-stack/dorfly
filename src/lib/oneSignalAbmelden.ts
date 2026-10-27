import { Capacitor } from '@capacitor/core'

/**
 * Trennt das Gerät vom OneSignal-Nutzer (OneSignal.logout()).
 *
 * Wird nach der Kontolöschung aufgerufen. Den Nutzer selbst löscht die
 * API-Route serverseitig; ohne logout() würde das Gerät aber weiter die
 * external_id des gelöschten Kontos tragen.
 *
 * Wirft nicht und wartet höchstens 2 Sekunden: Im Web kann es sein, dass das
 * SDK nie geladen wurde — dann läuft der Deferred-Callback nie.
 */
export async function oneSignalAbmelden(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { default: OneSignal } = await import('onesignal-cordova-plugin')
      OneSignal.logout()
      return
    }

    const win = window as Window & { OneSignalDeferred?: Array<(os: unknown) => void> }
    if (!win.OneSignalDeferred) return

    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 2000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      win.OneSignalDeferred!.push(async (OneSignal: any) => {
        try {
          await OneSignal.logout()
        } finally {
          clearTimeout(timer)
          resolve()
        }
      })
    })
  } catch (e) {
    console.error('[Push] Logout fehlgeschlagen', e)
  }
}
