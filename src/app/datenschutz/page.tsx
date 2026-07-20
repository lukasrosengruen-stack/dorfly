import { Logo } from '@/components/ui'

const C = {
  navy:   '#0D1B2A',
  blue:   '#0057A8',
  green:  '#00A878',
  bg:     '#F4F7FB',
  muted:  '#64748B',
  border: '#DDE6F0',
  white:  '#ffffff',
} as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: 20, fontWeight: 700, color: C.navy,
        marginBottom: 12, paddingBottom: 8,
        borderBottom: `2px solid ${C.border}`,
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: C.navy, lineHeight: 1.7, marginBottom: 12, fontSize: 15 }}>
      {children}
    </p>
  )
}

function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: C.navy, lineHeight: 1.7, marginBottom: 4, fontSize: 15 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#EFF6FF', border: `1px solid #BFDBFE`,
      borderRadius: 8, padding: '12px 16px', marginBottom: 16,
    }}>
      {children}
    </div>
  )
}

export default function DatenschutzPage() {
  const thirdParties = [
    {
      name: 'Supabase, Inc.',
      purpose: 'Datenbank, Authentifizierung, Dateispeicher, Demo-Anfragen (nur im Fehlerfall)',
      data: 'Alle Nutzerdaten, Inhalte, Medien',
      location: 'EU (Frankfurt) / AVV',
    },
    {
      name: 'OneSignal, Inc.',
      purpose: 'Push-Benachrichtigungen',
      data: 'Nutzer-ID, Gemeinde-Slug, Gerätedaten',
      location: 'USA / SCC (Art. 46 DSGVO)',
    },
    {
      name: 'Resend, Inc.',
      purpose: 'Transaktions-E-Mails, Demo-Anfragen',
      data: 'E-Mail-Adresse, Name',
      location: 'EU / AVV',
    },
    {
      name: 'Vercel Inc.',
      purpose: 'Hosting und Bereitstellung der Anwendung',
      data: 'Alle Nutzerdaten, Inhalte und Medien im Rahmen des technischen Hostings',
      location: 'USA / SCC (Art. 46 DSGVO)',
    },
  ]

  const rights = [
    { right: 'Auskunft (Art. 15 DSGVO)', desc: 'Recht auf Auskunft über die gespeicherten personenbezogenen Daten.' },
    { right: 'Berichtigung (Art. 16 DSGVO)', desc: 'Recht auf Berichtigung unrichtiger oder unvollständiger Daten.' },
    { right: 'Löschung (Art. 17 DSGVO)', desc: 'Recht auf Löschung der personenbezogenen Daten. Die Kontolöschung kann direkt in den Profileinstellungen vorgenommen werden.' },
    { right: 'Einschränkung (Art. 18 DSGVO)', desc: 'Recht auf Einschränkung der Verarbeitung unter bestimmten Voraussetzungen.' },
    { right: 'Datenübertragbarkeit (Art. 20 DSGVO)', desc: 'Recht, die bereitgestellten Daten in einem strukturierten, maschinenlesbaren Format zu erhalten.' },
    { right: 'Widerspruch (Art. 21 DSGVO)', desc: 'Recht, der Verarbeitung personenbezogener Daten zu widersprechen.' },
    { right: 'Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)', desc: 'Einwilligungen (z. B. Push-Benachrichtigungen, Standortfreigabe) können jederzeit widerrufen werden.' },
  ]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${C.border}`, padding: '0 24px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center' }}>
          <Logo />
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 8 }}>
          Datenschutzerklärung
        </h1>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 40 }}>
          Stand: Juli 2026
        </p>

        {/* 1 */}
        <Section title="1. Verantwortlicher">
          <P>
            Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
          </P>
          <InfoBox>
            <p style={{ margin: 0, color: C.navy, fontSize: 15, lineHeight: 1.8 }}>
              <strong>Dorfly</strong><br />
              Lukas Rosengrün<br />
              Goldregenweg 15<br />
              71139 Ehningen<br />
              Deutschland<br />
              E-Mail:{' '}
              <a href="mailto:lr@lukas-rosengruen.de" style={{ color: C.blue }}>
                lr@lukas-rosengruen.de
              </a>
            </p>
          </InfoBox>
        </Section>

        {/* 2 */}
        <Section title="2. Allgemeines zur Datenverarbeitung">
          <P>
            Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies
            zur Bereitstellung einer funktionsfähigen Plattform sowie unserer Leistungen erforderlich
            ist. Dorfly erhebt <strong>bewusst minimale Nutzerdaten</strong> und verzichtet
            vollständig auf Tracking, Nutzeranalyse und die Weitergabe von Daten zu Werbezwecken.
          </P>
        </Section>

        {/* 3 */}
        <Section title="3. Erhobene Daten und Zwecke der Verarbeitung">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
            3.1 Registrierung und Nutzerkonto
          </h3>
          <P>Zur Nutzung der Plattform ist ein Nutzerkonto erforderlich. Dabei werden folgende Daten erhoben:</P>
          <UL items={[
            'E-Mail-Adresse (Pflichtfeld – Authentifizierung und Kommunikation)',
            'Passwort (wird verschlüsselt gespeichert, nie im Klartext)',
            'Vorname und Nachname (freiwillig)',
            'Geburtsdatum (freiwillig)',
            'Adresse (freiwillig)',
            'Profilbild (freiwillig)',
            'Gemeinde-Zugehörigkeit',
            'Nutzerrolle (Bürger, Verein, Gewerbe, Gemeinderat, Verwaltung)',
          ]} />
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung);
            Art. 6 Abs. 1 lit. a DSGVO für freiwillige Angaben.
          </P>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8, marginTop: 20 }}>
            3.2 Nutzergenerierte Inhalte
          </h3>
          <UL items={[
            'Beiträge und Ankündigungen (Titel, Text, Bilder/Videos)',
            'Mängelberichte inkl. Beschreibung und Fotos',
            'Umfrage-Antworten',
            'Fragen an Bürgermeister oder Gemeinderatsmitglieder',
            'Feed-Einstellungen (persönliche Kanalauswahl)',
          ]} />
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
          </P>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8, marginTop: 20 }}>
            3.3 Standortdaten (Mängelmelder)
          </h3>
          <P>
            Beim Einreichen eines Mängelberichts kann der Nutzer seinen GPS-Standort freigeben.
            Die Standortabfrage erfolgt nur nach ausdrücklicher Browser-Zustimmung und ist nicht
            verpflichtend – die Adresse kann alternativ manuell eingegeben werden. Erfasste
            GPS-Koordinaten und die Adresse sind für andere Nutzer der Gemeinde einsehbar.
          </P>
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          </P>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8, marginTop: 20 }}>
            3.4 Push-Benachrichtigungen
          </h3>
          <P>
            Mit Einwilligung über die Browser-/Geräteberechtigung können Push-Benachrichtigungen
            aktiviert werden. Dabei werden über OneSignal Nutzer-ID und Gemeinde-Slug verarbeitet.
            Die Einwilligung kann jederzeit in den Profileinstellungen widerrufen werden.
          </P>
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          </P>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8, marginTop: 20 }}>
            3.5 E-Mail-Verifizierung
          </h3>
          <P>
            Zur Verifizierung der E-Mail-Adresse wird bei der Registrierung ein Bestätigungslink
            per E-Mail versendet. Das Konto wird erst nach Bestätigung des Links aktiv.
          </P>
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
          </P>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8, marginTop: 20 }}>
            3.6 Transaktions-E-Mails
          </h3>
          <P>
            Registrierungsbestätigungen und Passwort-Reset-Links werden über Resend versendet.
            Dabei werden E-Mail-Adresse und Name übermittelt.
          </P>
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
          </P>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8, marginTop: 20 }}>
            3.7 Demo-Anfragen (Marketing-Website)
          </h3>
          <P>
            Über das Kontaktformular der Marketing-Website können Gemeinden eine Demo anfragen.
            Dabei erhobene Daten (Name, E-Mail, Gemeinde, Nachricht (optional)) werden
            ausschließlich zur Beantwortung der Anfrage genutzt.
          </P>
          <P>
            Die Anfrage wird per E-Mail über den Auftragsverarbeiter Resend an die interne
            Kontaktadresse übermittelt. Schlägt der Mailversand fehl, wird die Anfrage
            vorübergehend in der Datenbank gespeichert, um sicherzustellen, dass sie nicht
            verloren geht. Diese Speicherung wird nach abgeschlossener Bearbeitung, spätestens
            nach 6 Monaten, gelöscht.
          </P>
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO bzw. Art. 6 Abs. 1 lit. b
            DSGVO (vorvertragliche Maßnahmen) für die Kontaktaufnahme; Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an der technischen Ausfallsicherung) für die
            Datenbank-Speicherung im Fehlerfall.
          </P>
        </Section>

        {/* 4 */}
        <Section title="4. Cookies und Sitzungsverwaltung">
          <P>
            Dorfly verwendet ausschließlich technisch notwendige Cookies zur Sitzungsverwaltung.
            Es werden <strong>keine Marketing-, Tracking- oder Analyse-Cookies</strong> eingesetzt.
          </P>
          <P>
            Nach der Anmeldung wird ein Authentifizierungstoken als HTTP-only-Cookie
            (Präfix: <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>sb-*-auth-token</code>) gespeichert.
            Dieses Cookie hält den Nutzer eingeloggt und wird bei der Abmeldung automatisch gelöscht.
          </P>
          <P>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
            an der technischen Bereitstellung der Plattform).
          </P>
        </Section>

        {/* 5 */}
        <Section title="5. Auftragsverarbeiter und Drittdienste">
          <P>
            Dorfly nutzt folgende externe Dienstleister, mit denen Auftragsverarbeitungsverträge (AVV)
            nach Art. 28 DSGVO geschlossen wurden bzw. die durch Standardvertragsklauseln (SCC) abgesichert sind:
          </P>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: C.navy, color: C.white }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Anbieter</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Zweck</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Übermittelte Daten</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Sitz / Grundlage</th>
                </tr>
              </thead>
              <tbody>
                {thirdParties.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.bg }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: C.navy, whiteSpace: 'nowrap' }}>{row.name}</td>
                    <td style={{ padding: '10px 14px', color: C.navy }}>{row.purpose}</td>
                    <td style={{ padding: '10px 14px', color: C.muted }}>{row.data}</td>
                    <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}>{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Bei Datenübermittlungen in die USA erfolgt die Absicherung durch
            Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO. Die betroffenen
            Anbieter sind in der Auftragsverarbeiter-Tabelle aufgeführt.
          </P>
        </Section>

        {/* 6 */}
        <Section title="6. Datenweitergabe an Dritte">
          <P>Eine Weitergabe personenbezogener Daten an Dritte findet nur statt:</P>
          <UL items={[
            'An die oben genannten Auftragsverarbeiter im Rahmen der Leistungserbringung',
            'An die jeweilige Gemeindeverwaltung zur Bearbeitung von Anliegenab (z. B. Mängelberichte)',
            'Wenn eine gesetzliche Verpflichtung besteht',
            'Mit ausdrücklicher Einwilligung des Nutzers',
          ]} />
          <P>Eine Weitergabe zu Werbe- oder Analysezwecken findet <strong>nicht</strong> statt.</P>
        </Section>

        {/* 7 */}
        <Section title="7. Speicherdauer und Datenlöschung">
          <UL items={[
            'Kontodaten: bis zur Löschung des Nutzerkontos',
            'Nutzergenerierte Inhalte: bis zur Kontolöschung oder auf Anfrage',
            'Session-Cookies: werden bei der Abmeldung gelöscht',
            'Demo-Anfragen: im Regelfall keine Speicherung (nur E-Mail-Versand); nur bei fehlgeschlagenem Mailversand wird die Anfrage in der Datenbank gespeichert und nach abgeschlossener Bearbeitung, spätestens nach 6 Monaten, gelöscht',
          ]} />
          <P>
            Nutzer können ihr Konto und alle damit verbundenen Daten jederzeit vollständig löschen
            (Profileinstellungen → Konto löschen). Die Löschung umfasst Profil, Beiträge,
            Mängelberichte, Umfrage-Antworten, gestellte Fragen und alle weiteren nutzerbezogenen Daten.
          </P>
        </Section>

        {/* 8 */}
        <Section title="8. Sicherheit der Datenverarbeitung">
          <UL items={[
            'SSL/TLS-Verschlüsselung aller Datenübertragungen',
            'Verschlüsselte Passwortspeicherung (bcrypt-Hash)',
            'Zeilenbasierte Zugriffskontrolle (Row-Level Security) auf Datenbankebene',
            'HTTP-only-Cookies für Authentifizierungstoken',
            'Eingabevalidierung aller API-Endpunkte',
            'Rollen- und rechtebasiertes Zugriffssystem',
          ]} />
        </Section>

        {/* 9 */}
        <Section title="9. Rechte der betroffenen Personen">
          <P>Nutzer haben gegenüber dem Verantwortlichen folgende Rechte:</P>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {rights.map(({ right, desc }, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${C.blue}`, paddingLeft: 12 }}>
                <p style={{ margin: 0, fontWeight: 700, color: C.navy, fontSize: 15 }}>{right}</p>
                <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
          <P>
            Zur Wahrnehmung dieser Rechte:{' '}
            <a href="mailto:lr@lukas-rosengruen.de" style={{ color: C.blue }}>
              lr@lukas-rosengruen.de
            </a>
          </P>
          <P>
            Zusätzlich besteht das Recht, bei der zuständigen Datenschutz-Aufsichtsbehörde
            des jeweiligen Bundeslandes Beschwerde einzulegen.
          </P>
        </Section>

        {/* 10 */}
        <Section title="10. Progressive Web App (PWA)">
          <P>
            Dorfly kann als PWA auf dem Homescreen von Smartphones installiert werden. Bei der
            Installation werden keine zusätzlichen personenbezogenen Daten erhoben. Die installierte
            App unterliegt denselben Datenschutzbestimmungen wie die Webanwendung.
          </P>
        </Section>

        {/* 11 */}
        <Section title="11. Gemeinden als Verantwortliche">
          <P>
            Die jeweilige Gemeinde agiert als eigenständiger Verantwortlicher im Sinne der DSGVO
            für die auf ihrer Instanz verarbeiteten Daten. Dorfly stellt die technische Infrastruktur
            als Auftragsverarbeiter gemäß Art. 28 DSGVO bereit. Für gemeindespezifische
            Datenschutzanfragen wenden Sie sich bitte direkt an Ihre Gemeindeverwaltung.
          </P>
        </Section>

        {/* 12 */}
        <Section title="12. Aktualität und Änderungen">
          <P>
            Diese Datenschutzerklärung hat den Stand Juli 2026. Bei Änderungen der Plattform oder
            der Rechtslage wird sie entsprechend aktualisiert. Die jeweils aktuelle Version ist
            unter{' '}
            <a href="/datenschutz" style={{ color: C.blue }}>dorfly.app/datenschutz</a>{' '}
            abrufbar.
          </P>
        </Section>

        <div style={{
          marginTop: 48, padding: '20px 24px', borderRadius: 10,
          background: C.white, border: `1px solid ${C.border}`,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 22 }}>✉</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: C.navy, fontSize: 15 }}>Kontakt bei Datenschutzfragen</p>
            <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 14 }}>
              <a href="mailto:lr@lukas-rosengruen.de" style={{ color: C.blue }}>
                lr@lukas-rosengruen.de
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
