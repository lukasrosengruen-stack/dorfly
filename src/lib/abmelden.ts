/**
 * Abmelden in der richtigen Reihenfolge: erst OneSignal, dann Supabase.
 *
 * Der Löschpfad in /profil/datenschutz-daten/konto-loeschen ruft
 * oneSignalAbmelden() bereits, der Abmeldeknopf im Profil bisher nicht. Auf
 * einem geteilten Gerät trug OneSignal dadurch weiter die external_id des
 * Vorgängers, und dessen Push-Nachrichten landeten bei der nächsten Person.
 *
 * Erst OneSignal: Nach signOut() ist die Session weg, und ein Logout, der eine
 * Netzwerkanfrage braucht, soll nicht von einer gerade entfernten Session
 * abhängen.
 *
 * Ein Fehler bei OneSignal darf die Abmeldung nie verhindern, die Session
 * loszuwerden ist das Wichtigere. oneSignalAbmelden() wirft von sich aus nicht,
 * der try bleibt trotzdem, damit das hier unabhängig von dieser Zusage gilt.
 * Ein Fehler von signOut() geht dagegen an den Aufrufer: Wer nicht abgemeldet
 * wurde, darf nicht weitergeleitet werden, als wäre er es.
 */
export async function abmelden(deps: {
  oneSignalAbmelden: () => Promise<void>
  signOut: () => Promise<unknown>
}): Promise<void> {
  try {
    await deps.oneSignalAbmelden()
  } catch (e) {
    console.error('[Abmelden] OneSignal-Logout fehlgeschlagen', e)
  }
  await deps.signOut()
}
