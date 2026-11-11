/**
 * Willkommensmail für neue Mitglieder eines Vereins, einer Organisation oder
 * eines Gewerbes. Geht automatisch raus — bei der Einladung (noch kein Konto)
 * und beim direkten Hinzufügen (Konto vorhanden), siehe src/lib/email.ts.
 *
 * Reine Funktion ohne Versand, damit Text und Varianten testbar sind.
 * Keine zeitgebundenen Aussagen („noch in diesem Jahr …“): die Mail läuft
 * unverändert über Monate.
 */

export type Vereinsrolle = 'verein' | 'organisation' | 'gewerbe'

export function istVereinsrolle(rolle: string): rolle is Vereinsrolle {
  return rolle === 'verein' || rolle === 'organisation' || rolle === 'gewerbe'
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Dieselben Links wie die Badges auf der Landingpage (src/app/homepage/page.tsx)
export const APP_STORE = 'https://apps.apple.com/de/app/dorfly/id6791239032'
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=de.dorfly.app'
// Mails kommen von noreply@ — Rückmeldungen an die Adresse der Support-Seite
export const KONTAKT = 'hallo@dorfly.de'

// ihr: Nominativ („Ihr Verein erreicht …“), fuer: Akkusativ („für Ihren Verein“)
const ART: Record<Vereinsrolle, { ihr: string; fuer: string; profil: string; verzeichnis: string }> = {
  verein:       { ihr: 'Ihr Verein',        fuer: 'Ihren Verein',      profil: 'Vereinsprofil',       verzeichnis: 'im Vereinsverzeichnis' },
  organisation: { ihr: 'Ihre Organisation', fuer: 'Ihre Organisation', profil: 'Organisationsprofil', verzeichnis: 'im Vereinsverzeichnis' },
  gewerbe:      { ihr: 'Ihr Betrieb',       fuer: 'Ihren Betrieb',     profil: 'Betriebsprofil',      verzeichnis: 'unter „Lokale Angebote“' },
}

export interface WillkommensDaten {
  typ: Vereinsrolle
  /** null: Einladung der Verwaltung für einen neuen Verein — die Person wird Verwalter. */
  mitgliedRolle: 'verwalter' | 'autor' | null
  organisationName: string | null
  gemeindeName: string
  gemeindeSlug: string
  /** z.B. „der Verein „TSV““; null = „die Gemeindeverwaltung …“ */
  absender: string | null
  hinweis?: string | null
  /** Registrierungslink (eingeladen) oder Dashboard-Link (Konto vorhanden). */
  link: string
  eingeladen: boolean
}

export function willkommensMail(d: WillkommensDaten): { betreff: string; html: string } {
  const art = ART[d.typ]
  const verwalter = d.mitgliedRolle !== 'autor'
  const rolleWort = verwalter ? 'Verwalter' : 'Autor'
  const name = d.organisationName ? escapeHtml(d.organisationName) : null
  const ziel = name ? `<strong>${name}</strong>` : art.fuer
  // Fügt ein Vereinsmitglied jemanden hinzu, stünde der Vereinsname sonst doppelt im Satz
  const eingetragen = d.absender
    ? `Sie wurden als <strong>${rolleWort}</strong> für ${ziel} in Dorfly eingetragen.`
    : `Die Gemeindeverwaltung <strong>${escapeHtml(d.gemeindeName)}</strong> hat Sie als <strong>${rolleWort}</strong> für ${ziel} in Dorfly eingetragen.`
  const dashboard = `https://${d.gemeindeSlug}.dorfly.de/dashboard`

  const betreff = d.organisationName
    ? `Willkommen bei Dorfly ${d.gemeindeName}: Sie ${verwalter ? 'verwalten' : 'schreiben'} jetzt ${verwalter ? '' : 'für '}${d.organisationName}`
    : `Willkommen bei Dorfly ${d.gemeindeName}`

  const beitraege = d.typ === 'gewerbe'
    ? 'Ihre Beiträge erscheinen sofort bei allen, die Ihren Betrieb abonniert haben.'
    : 'Beiträge werden vor der Veröffentlichung kurz von der Gemeindeverwaltung geprüft. Den Stand sehen Sie in Ihrer Beitragsliste.'

  const schritte = [
    d.eingeladen
      ? '<strong>Registrieren:</strong> Über den Button unten legen Sie Ihr Konto an. Die Einladung ist 7 Tage gültig.'
      : '<strong>Anmelden:</strong> Melden Sie sich mit Ihrem bestehenden Dorfly-Konto an.',
    `<strong>Dashboard öffnen:</strong> <a href="${dashboard}">${dashboard.replace('https://', '')}</a>`,
    ...(verwalter
      ? [`<strong>${art.profil} prüfen:</strong> Über „Profil“ ergänzen Sie Logo, Beschreibung und Website. So wird ${art.ihr} ${art.verzeichnis} gefunden.`]
      : []),
    `<strong>Ersten Beitrag schreiben:</strong> ${beitraege}`,
  ]

  const rolleText = verwalter
    ? `Als Verwalter schreiben Sie Beiträge und pflegen das ${art.profil} und das Team.`
    : `Als Autor schreiben und bearbeiten Sie Beiträge. Profil und Team pflegen die Verwalter.`

  const team = verwalter ? `
      <h3 style="color:#1a1a1a;margin-top:24px">Ihr Team</h3>
      <p>Sie können weitere Personen einladen, zum Beispiel aus dem Vorstand oder der Pressearbeit. Im Dashboard gibt es dafür unten den Bereich <strong>„Team“</strong>. Dort legen Sie fest, ob jemand <strong>Autor</strong> wird oder ebenfalls <strong>Verwalter</strong>.</p>
      <p>Wechselt später die Zuständigkeit, fügen Sie Ihre Nachfolge als Verwalter hinzu und treten danach selbst aus. ${art.ihr}, alle Beiträge und Abonnenten bleiben dabei erhalten.</p>` : ''

  const button = d.eingeladen ? 'Jetzt registrieren' : 'Zum Dashboard'

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="color:#1a1a1a">Willkommen bei Dorfly ${escapeHtml(d.gemeindeName)}!</h2>
      <p>Guten Tag,</p>
      <p>${eingetragen} Schön, dass Sie dabei sind!</p>
      <p>Über Dorfly erreicht ${art.ihr} die Menschen in ${escapeHtml(d.gemeindeName)} direkt auf dem Smartphone: mit Neuigkeiten, Veranstaltungen und Angeboten. ${rolleText}</p>
      ${d.hinweis ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px"><strong>Hinweis:</strong> ${escapeHtml(d.hinweis)}</p>` : ''}
      <h3 style="color:#1a1a1a;margin-top:24px">Ihre ersten Schritte</h3>
      <ol style="padding-left:20px">${schritte.map(s => `<li style="margin-bottom:8px">${s}</li>`).join('')}</ol>
      <a href="${d.link}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:8px 0">${button}</a>
      ${team}
      <h3 style="color:#1a1a1a;margin-top:24px">Dorfly als App</h3>
      <p>Dorfly gibt es als App für iPhone im <a href="${APP_STORE}">App Store</a> und für Android im <a href="${PLAY_STORE}">Google Play Store</a>.</p>
      <h3 style="color:#1a1a1a;margin-top:24px">Fragen oder Ideen?</h3>
      <p>Schreiben Sie uns an <a href="mailto:${KONTAKT}">${KONTAKT}</a>. Wir freuen uns über jede Rückmeldung, denn sie hilft uns, Dorfly weiter zu verbessern.</p>
      <p>Viele Grüße<br>Ihr Dorfly-Team</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">Falls Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.</p>
    </div>
  `

  return { betreff, html }
}
