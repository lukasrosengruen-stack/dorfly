import type { Metadata } from 'next'
import LegalNav from '@/components/layout/LegalNav'

// Öffentliche Seite für Google Play ("Löschung ohne installierte App").
// Die URL ist in der Play Console hinterlegt und darf sich nicht ändern.
// Die Angaben zu "Was gelöscht wird" und "Was bleibt" spiegeln
// supabase/migrations/064_konto_loeschen.sql und src/lib/kontoLoeschen.ts wider —
// bei Änderungen an der Löschung diese Seite mitziehen.

const C = {
  navy:   '#0D1B2A',
  blue:   '#0057A8',
  green:  '#00A878',
  bg:     '#F4F7FB',
  muted:  '#64748B',
  border: '#DDE6F0',
  white:  '#ffffff',
} as const

const MAILTO = 'mailto:hallo@dorfly.de?subject=Kontol%C3%B6schung'

export const metadata: Metadata = {
  title: 'Konto löschen – Dorfly',
  description: 'So löschen Sie Ihr Konto in der App Dorfly der Dorfly UG (haftungsbeschränkt), mit oder ohne App.',
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ marginBottom: 40 }}>
      <h2 id={id} style={{
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

function List({ items, ordered = false }: { items: React.ReactNode[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag style={{ paddingLeft: 24, marginBottom: 12, listStyle: ordered ? 'decimal' : 'disc' }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: C.navy, lineHeight: 1.7, marginBottom: 6, fontSize: 15 }}>
          {item}
        </li>
      ))}
    </Tag>
  )
}

export default function KontoLoeschenPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <LegalNav />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 16 }}>
          Konto löschen
        </h1>
        <P>
          Diese Seite gilt für die App <strong>Dorfly</strong> der Dorfly UG (haftungsbeschränkt).
          Sie können Ihr Dorfly-Konto jederzeit löschen. Dafür gibt es zwei Wege.
        </P>

        <Section id="in-der-app" title="In der App">
          <List ordered items={[
            'Öffnen Sie die App Dorfly und melden Sie sich an.',
            <>Tippen Sie oben rechts auf das Personen-Symbol. Oder tippen Sie auf der Startseite auf <strong>„Mein Profil“</strong>.</>,
            <>Scrollen Sie nach unten zum Bereich <strong>„Rechtliches“</strong>.</>,
            <>Tippen Sie auf <strong>„Datenschutz & Daten“</strong>.</>,
            <>Tippen Sie auf <strong>„Konto löschen“</strong>.</>,
            <>Tippen Sie auf <strong>„Konto unwiderruflich löschen“</strong>.</>,
            <>Bestätigen Sie mit <strong>„Endgültig löschen“</strong>.</>,
          ]} />
          <P>
            Ihr Konto wird sofort gelöscht. Danach werden Sie abgemeldet.
          </P>
        </Section>

        <Section id="ohne-app" title="Ohne App">
          <P>
            Sie haben die App nicht mehr? Dann schreiben Sie uns eine E-Mail.
          </P>
          <List ordered items={[
            <>Schreiben Sie an <a href={MAILTO} style={{ color: C.blue, fontWeight: 600 }}>hallo@dorfly.de</a>.</>,
            <>Verwenden Sie den Betreff <strong>„Kontolöschung“</strong>.</>,
            'Nennen Sie die E-Mail-Adresse, mit der Sie bei Dorfly registriert sind.',
          ]} />
          <P>
            Wir bearbeiten Ihre Anfrage innerhalb von 30 Tagen. Sie erhalten eine Bestätigung per E-Mail,
            sobald Ihr Konto gelöscht ist.
          </P>
          <p style={{ marginBottom: 12 }}>
            <a
              href={MAILTO}
              style={{
                display: 'inline-block', background: C.blue, color: C.white,
                fontWeight: 600, fontSize: 15, padding: '12px 20px', borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              E-Mail zur Kontolöschung schreiben
            </a>
          </p>
        </Section>

        <Section id="was-geloescht-wird" title="Was gelöscht wird">
          <P>
            Mit Ihrem Konto löschen wir die folgenden Daten sofort und endgültig.
          </P>
          <List items={[
            'Ihre Anmeldedaten: E-Mail-Adresse und Passwort.',
            'Ihr Profil mit Ihrem Namen, Ihrem Profilbild und allen weiteren Angaben.',
            'Ihre Mängelmeldungen mit Fotos und Standort.',
            'Ihre Fragen an den Bürgermeister und an den Gemeinderat. Die Antworten darauf werden mitgelöscht.',
            'Ihre Abos von Vereinen und Gewerbebetrieben.',
            'Ihre Einstellungen zum Abfallkalender.',
            'Ihre Meldungen von Inhalten an uns.',
            'Ihre Kennung für Push-Benachrichtigungen bei unserem Dienstleister OneSignal.',
          ]} />
          <P>
            Haben Sie ein Konto für einen Verein, ein Gewerbe oder die Verwaltung? Dann löschen wir
            zusätzlich Ihre Beiträge, Ihre Umfragen und Ihr Vereins- oder Gewerbeprofil, jeweils mit
            allen Bildern.
          </P>
          <P>
            Ihre Antworten in Umfragen werden nicht gelöscht, sondern anonymisiert.
          </P>
        </Section>

        <Section id="was-bleibt" title="Was bleibt">
          <List items={[
            'Ihre Antworten in Umfragen bleiben ohne Bezug zu Ihrer Person im Ergebnis erhalten.',
            <>
              <strong>Sicherungskopien:</strong> Sicherungskopien unserer Datenbank werden spätestens
              nach 30 Tagen automatisch überschrieben. Bis dahin können Ihre Daten dort noch enthalten sein.
            </>,
            <>
              <strong>Newsletter:</strong> Die Anmeldung zum Newsletter auf dorfly.de ist nicht mit
              Ihrem Konto verbunden. Sie bleibt deshalb bestehen. Wenn wir sie auch löschen sollen,
              schreiben Sie das bitte in Ihre E-Mail.
            </>,
          ]} />
        </Section>

        <P>
          Mehr zum Umgang mit Ihren Daten lesen Sie in der{' '}
          <a href="/datenschutz" style={{ color: C.blue }}>Datenschutzerklärung</a>.
        </P>
      </main>
    </div>
  )
}
