/**
 * Willkommensmail für neu registrierte Bürger. Vereins- und Gewerbe-Teams bekommen
 * stattdessen die Mail aus willkommensMail.ts.
 *
 * Reine Funktion ohne Versand, damit Text und Varianten testbar sind. Genannt wird
 * nur, was in der Gemeinde freigeschaltet ist. Keine zeitgebundenen Aussagen: die
 * Mail läuft unverändert über Monate.
 */

import { getBuergermeisterLabel, type GemeindeFeatures } from '@/lib/features'
import { APP_STORE, KONTAKT, PLAY_STORE, escapeHtml } from '@/lib/willkommensMail'

export interface BuergerWillkommensDaten {
  vorname: string | null
  /** Ohne Namen kann man keine Fragen stellen — dann steht „Namen eintragen“ an erster Stelle. */
  hatName: boolean
  gemeindeName: string
  gemeindeSlug: string
  features: GemeindeFeatures
}

const H3 = 'style="color:#1a1a1a;margin-top:24px"'

export function buergerWillkommensMail(d: BuergerWillkommensDaten): { betreff: string; html: string } {
  const gemeinde = escapeHtml(d.gemeindeName)
  const f = d.features
  const rathaus = getBuergermeisterLabel({ features: f }).long
  const rathausEmpfaenger = rathaus === 'Frag die Verwaltung' ? 'die Verwaltung' : 'den Bürgermeister'
  const app = `https://${d.gemeindeSlug}.dorfly.de/home`

  const fragenAn = f.gemeinderat ? `${rathausEmpfaenger} oder den Gemeinderat` : rathausEmpfaenger
  const verzeichnisse = [f.vereine && '<em>Vereine</em>', f.gewerbe && '<em>Lokale Angebote</em>'].filter(Boolean)
  const abonniert = [f.vereine && 'Vereine, Organisationen', f.gewerbe && 'Betriebe'].filter(Boolean).join(' und ')

  const schritte = [
    !d.hatName &&
      `<strong>Namen eintragen:</strong> Unter <em>Profil → Bearbeiten</em> tragen Sie Vor- und Nachnamen ein. Ohne Namen können Sie keine Fragen an ${fragenAn} stellen.`,
    `<strong>Benachrichtigungen einschalten:</strong> Unter <em>Profil</em> aktivieren Sie Push-Nachrichten. So erfahren Sie sofort von Warnungen und von Neuigkeiten zu Ihren Meldungen.`,
    verzeichnisse.length > 0 &&
      `<strong>Feed nach Ihrem Geschmack:</strong> Damit Sie nichts verpassen, haben Sie alle ${abonniert} aus ${gemeinde} bereits abonniert. Was Sie nicht interessiert, bestellen Sie unter ${verzeichnisse.join(' oder ')} mit einem Tipp auf die Glocke ab. Genauso einfach abonnieren Sie es später wieder.`,
    f.abfallkalender &&
      `<strong>Abfallkalender einrichten:</strong> Wählen Sie unter <em>Abfallkalender → Einstellungen</em> Ihre Tonnen aus. Am Vorabend jeder Abholung erinnern wir Sie um 18 Uhr per Push oder E-Mail.`,
  ].filter(Boolean)

  const funktionen = [
    `<strong>${rathaus}:</strong> Stellen Sie Ihre Frage direkt. Sie entscheiden, ob sie öffentlich sichtbar ist oder nur die Verwaltung sie sieht. Die Antwort bekommen Sie per E-Mail.`,
    f.gemeinderat &&
      `<strong>Gemeinderat:</strong> Lernen Sie Ihre Gemeinderätinnen und Gemeinderäte kennen und schreiben Sie ihnen direkt.`,
    `<strong>Warnmeldungen:</strong> Unwetterwarnungen des Deutschen Wetterdienstes und Warnmeldungen der Gemeinde, etwa zu Straßensperrungen, Wasserrohrbrüchen oder einem Abkochgebot. Mit eingeschalteten Push-Nachrichten erfahren Sie davon sofort.`,
    `<strong>Mängelmelder:</strong> Schlagloch, defekte Straßenlaterne, wilder Müll? Melden Sie es mit Foto und Ort. Sie werden benachrichtigt, sobald sich der Stand ändert.`,
    f.umfragen && `<strong>Umfragen:</strong> Stimmen Sie ab, wenn die Gemeinde Ihre Meinung wissen möchte.`,
    `<strong>Veranstaltungen:</strong> Alle Termine im Ort auf einen Blick.`,
  ].filter(Boolean)

  const anrede = d.vorname ? `Guten Tag ${escapeHtml(d.vorname)},` : 'Guten Tag,'

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="color:#1a1a1a">Willkommen bei Dorfly ${gemeinde}!</h2>
      <p>${anrede}</p>
      <p>schön, dass Sie dabei sind! Mit Dorfly haben Sie Ihre Gemeinde in der Hosentasche: Neuigkeiten aus dem Rathaus, Termine im Ort und einen direkten Draht zur Verwaltung.</p>
      <h3 ${H3}>Ihre ersten Schritte</h3>
      <ol style="padding-left:20px">${schritte.map(s => `<li style="margin-bottom:8px">${s}</li>`).join('')}</ol>
      <a href="${app}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:8px 0">Dorfly öffnen</a>
      <h3 ${H3}>Was Sie mit Dorfly noch tun können</h3>
      <ul style="padding-left:20px">${funktionen.map(s => `<li style="margin-bottom:8px">${s}</li>`).join('')}</ul>
      <h3 ${H3}>Dorfly als App</h3>
      <p>Dorfly gibt es als App für iPhone im <a href="${APP_STORE}">App Store</a> und für Android im <a href="${PLAY_STORE}">Google Play Store</a>.</p>
      <h3 ${H3}>Ihre Daten</h3>
      <p>Unter <em>Profil → Datenschutz &amp; Daten</em> sehen Sie jederzeit, welche Daten gespeichert sind, und können Ihr Konto löschen.</p>
      <h3 ${H3}>Fragen oder Ideen?</h3>
      <p>Schreiben Sie uns an <a href="mailto:${KONTAKT}">${KONTAKT}</a>. Wir freuen uns über jede Rückmeldung.</p>
      <p>Viele Grüße<br>Ihr Dorfly-Team</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">Sie erhalten diese E-Mail, weil Sie sich bei Dorfly ${gemeinde} registriert haben.</p>
    </div>
  `

  return { betreff: `Willkommen bei Dorfly ${d.gemeindeName}, so legen Sie los`, html }
}
