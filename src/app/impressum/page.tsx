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
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 18, fontWeight: 700, color: C.navy,
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
    <p style={{ color: C.navy, lineHeight: 1.7, marginBottom: 10, fontSize: 15 }}>
      {children}
    </p>
  )
}

export default function ImpressumPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
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
        <h1 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 40 }}>
          Impressum
        </h1>

        {/* Angaben gemäß § 5 DDG */}
        <Section title="Angaben gemäß § 5 DDG">
          <P>
            <strong>Lukas Rosengrün</strong><br />
            Goldregenweg 15<br />
            71139 Ehningen<br />
            Deutschland
          </P>
        </Section>

        {/* Kontakt */}
        <Section title="Kontakt">
          <P>
            E-Mail:{' '}
            <a href="mailto:lr@lukas-rosengruen.de" style={{ color: C.blue }}>
              lr@lukas-rosengruen.de
            </a>
          </P>
        </Section>

        {/* Verantwortlich für den Inhalt */}
        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <P>
            Lukas Rosengrün<br />
            Goldregenweg 15<br />
            71139 Ehningen
          </P>
        </Section>

        {/* Haftungsausschluss */}
        <Section title="Haftungsausschluss">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
            Haftung für Inhalte
          </h3>
          <P>
            Die Inhalte dieser Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach Art. 4 bis 6 der Verordnung (EU)
            2022/2065 (Digital Services Act) sind wir als Diensteanbieter jedoch nicht verpflichtet,
            übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
            zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </P>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 6, marginTop: 16 }}>
            Haftung für Links
          </h3>
          <P>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
            Seiten verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links
            umgehend entfernen.
          </P>
        </Section>

        {/* Urheberrecht */}
        <Section title="Urheberrecht">
          <P>
            Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
            deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung
            des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den
            privaten, nicht kommerziellen Gebrauch gestattet.
          </P>
        </Section>

        {/* Streitschlichtung */}
        <Section title="Streitschlichtung">
          <P>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.blue }}
            >
              https://ec.europa.eu/consumers/odr
            </a>
            .
          </P>
          <P>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </P>
        </Section>

        <div style={{
          marginTop: 48, padding: '16px 20px', borderRadius: 10,
          background: C.white, border: `1px solid ${C.border}`,
          display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <a href="/datenschutz" style={{ color: C.blue, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            → Datenschutzerklärung
          </a>
        </div>
      </main>
    </div>
  )
}
