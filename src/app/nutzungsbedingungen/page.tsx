import { Logo } from '@/components/ui'

export const metadata = {
  title: 'Nutzungsbedingungen — Dorfly',
}

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

export default function NutzungsbedingungenPage() {
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
          Nutzungsbedingungen Dorfly
        </h1>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 40 }}>
          Stand: 22.7.2026, Version 1.0
        </p>

        <Section title="§ 1 Geltungsbereich und Vertragspartner">
          <P>(1) Diese Nutzungsbedingungen regeln die Nutzung der Kommunikationsplattform Dorfly (nachfolgend „Plattform") durch registrierte Nutzerinnen und Nutzer.</P>
          <P>(2) Betreiberin der Plattform und Vertragspartnerin der Nutzerinnen und Nutzer ist die Dorfly UG (haftungsbeschränkt) i.G., Goldregenweg 15, 71139 Ehningen (nachfolgend „Betreiberin").</P>
          <P>(3) Die Plattform wird jeweils für eine bestimmte Gemeinde bereitgestellt. Die jeweilige Gemeinde ist für die amtlichen und redaktionellen Inhalte ihres Bereichs verantwortlich und benennt hierfür eine verantwortliche Person im Sinne des § 18 Medienstaatsvertrag. Die Betreiberin stellt ausschließlich die technische Plattform zur Verfügung.</P>
          <P>(4) Es gelten diese Nutzungsbedingungen in ihrer bei Vertragsschluss gültigen Fassung.</P>
        </Section>

        <Section title="§ 2 Leistungsbeschreibung">
          <P>(1) Die Plattform ermöglicht die lokale Kommunikation zwischen der Gemeinde, ihrer Bürgerschaft, ihren Vereinen, ihren Gewerbetreibenden und weiteren örtlichen Akteuren. Sie umfasst je nach Freischaltung durch die Gemeinde insbesondere Nachrichten und Beiträge, den Mängelmelder, die Funktion „Frag den Bürgermeister", Umfragen, das Gemeinderat-Feature, lokale Angebote, den Abfallkalender, Vereinsfunktionen, Warnmeldungen sowie Push-Benachrichtigungen.</P>
          <P>(2) Welche Funktionen im Einzelfall verfügbar sind, entscheidet die jeweilige Gemeinde. Ein Anspruch auf einen bestimmten Funktionsumfang besteht nicht.</P>
        </Section>

        <Section title="§ 3 Registrierung und Nutzerkonto">
          <P>(1) Die Nutzung von Beitrags- und Interaktionsfunktionen setzt eine Registrierung voraus. Bei der Registrierung sind wahrheitsgemäße Angaben zu machen.</P>
          <P>(2) Die Registrierung ist Personen ab 16 Jahren gestattet.</P>
          <P>(3) Die Zugangsdaten sind vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben werden. Bei Verdacht auf Missbrauch ist die Betreiberin unverzüglich zu informieren.</P>
          <P>(4) Ein Anspruch auf Registrierung besteht nicht. Die Betreiberin und die jeweilige Gemeinde können die Freischaltung aus sachlichem Grund verweigern.</P>
        </Section>

        <Section title="§ 4 Rollen und Berechtigungen">
          <P>(1) Die Plattform unterscheidet verschiedene Rollen mit unterschiedlichen Rechten, insbesondere Bürgerinnen und Bürger, Organisationen (Vereine und Gewerbe), Verwaltung sowie Gemeinderat.</P>
          <P>(2) Der Umfang der Berechtigungen richtet sich nach der zugewiesenen Rolle. Die Zuweisung erfolgt durch die jeweilige Gemeinde oder die Betreiberin.</P>
        </Section>

        <Section title="§ 5 Verhaltensregeln für alle Nutzerinnen und Nutzer">
          <P>(1) Der Umgang auf der Plattform ist von gegenseitigem Respekt und einem sachlichen Ton getragen. Beiträge und Kommentare sind höflich und angemessen zu formulieren.</P>
          <P>(2) Untersagt sind insbesondere: Beleidigungen, Herabwürdigungen und persönliche Angriffe. Aufrufe zu Gewalt sowie hetzerische, diskriminierende oder volksverhetzende Inhalte. Rechtswidrige Inhalte jeder Art. Die Verbreitung falscher Tatsachenbehauptungen. Die Veröffentlichung personenbezogener Daten Dritter ohne deren Einwilligung. Werbung außerhalb der dafür vorgesehenen Bereiche sowie Spam. Die Verletzung von Urheber-, Marken- oder sonstigen Schutzrechten. Missbräuchliche oder wahrheitswidrige Meldungen, insbesondere im Mängelmelder und bei Warnmeldungen.</P>
          <P>(3) Die Nutzerinnen und Nutzer stellen sicher, dass sie zur Veröffentlichung der von ihnen eingestellten Inhalte berechtigt sind.</P>
        </Section>

        <Section title="§ 6 Zusätzliche Pflichten institutioneller Autoren">
          <P>(1) Für Beiträge von Verwaltung, Gemeinderat, Vereinen und Gewerbe gelten über die Verhaltensregeln nach § 5 hinaus die redaktionellen Grundsätze der jeweiligen Gemeinde für ihre amtliche und lokale Kommunikation.</P>
          <P>(2) Soweit die jeweilige Gemeinde ein schriftliches Redaktionsstatut oder vergleichbare redaktionelle Richtlinien führt und diese den betreffenden Autoren zugänglich macht, gelten diese für deren Beiträge entsprechend.</P>
          <P>(3) Institutionelle Autoren tragen die inhaltliche Verantwortung für ihre Beiträge selbst. Sie beachten die für sie geltenden rechtlichen Vorgaben, insbesondere das Gebot der Sachlichkeit und, soweit einschlägig, die Grenzen zulässiger kommunaler Öffentlichkeitsarbeit.</P>
        </Section>

        <Section title="§ 7 Verantwortlichkeit für Inhalte">
          <P>(1) Für von Nutzerinnen und Nutzern eingestellte Inhalte ist die jeweils einstellende Person verantwortlich. Diese Inhalte geben nicht die Auffassung der Betreiberin oder der Gemeinde wieder.</P>
          <P>(2) Die Betreiberin macht sich fremde Inhalte nicht zu eigen. Ihre Haftung für fremde Inhalte richtet sich nach der gesetzlichen Haftungsprivilegierung für Diensteanbieter nach dem Digitale-Dienste-Gesetz und dem Digital Services Act.</P>
        </Section>

        <Section title="§ 8 Rechte an Inhalten">
          <P>(1) Die Rechte an eigenen Inhalten verbleiben bei der jeweiligen Nutzerin oder dem jeweiligen Nutzer.</P>
          <P>(2) Mit dem Einstellen räumt die Nutzerin oder der Nutzer der Betreiberin und der jeweiligen Gemeinde das einfache, räumlich und zeitlich auf den Betrieb der Plattform beschränkte Recht ein, die Inhalte im Rahmen der Plattform zu speichern, anzuzeigen und technisch zu verarbeiten. Eine darüber hinausgehende Nutzung erfolgt nicht.</P>
          <P>(3) Das Nutzungsrecht endet mit der Löschung des jeweiligen Inhalts, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</P>
        </Section>

        <Section title="§ 9 Moderation, Sperrung und Entfernung von Inhalten">
          <P>(1) Die Betreiberin und die jeweilige Gemeinde sind berechtigt, Inhalte, die gegen diese Nutzungsbedingungen oder gegen geltendes Recht verstoßen, zu entfernen oder zu sperren.</P>
          <P>(2) Bei wiederholten oder schwerwiegenden Verstößen können Nutzerkonten vorübergehend oder dauerhaft gesperrt werden. Die betroffene Person wird über die Maßnahme informiert, soweit dem keine rechtlichen Gründe entgegenstehen.</P>
          <P>(3) Eine Vorabprüfung sämtlicher Inhalte findet nicht statt. Die Prüfung erfolgt nach Kenntniserlangung, insbesondere aufgrund von Meldungen.</P>
        </Section>

        <Section title="§ 10 Verfügbarkeit">
          <P>Die Betreiberin bemüht sich um eine hohe Verfügbarkeit der Plattform. Ein Anspruch auf ununterbrochene Verfügbarkeit besteht nicht. Wartungsarbeiten, Störungen und Umstände außerhalb des Einflussbereichs der Betreiberin können die Nutzung vorübergehend einschränken.</P>
        </Section>

        <Section title="§ 11 Haftung">
          <P>(1) Die Betreiberin haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit.</P>
          <P>(2) Bei einfacher Fahrlässigkeit haftet die Betreiberin nur bei Verletzung einer wesentlichen Vertragspflicht und begrenzt auf den vertragstypischen, vorhersehbaren Schaden.</P>
          <P>(3) Im Übrigen ist die Haftung ausgeschlossen. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.</P>
        </Section>

        <Section title="§ 12 Datenschutz">
          <P>Die Verarbeitung personenbezogener Daten richtet sich nach der Datenschutzerklärung der jeweiligen Gemeinde, die über die Plattform abrufbar ist.</P>
        </Section>

        <Section title="§ 13 Laufzeit, Kündigung und Kontolöschung">
          <P>(1) Das Nutzungsverhältnis wird auf unbestimmte Zeit geschlossen und kann von der Nutzerin oder dem Nutzer jederzeit ohne Angabe von Gründen beendet werden.</P>
          <P>(2) Die Löschung des Kontos ist innerhalb der Plattform selbst möglich, unter „Mein Profil, Datenschutz und Daten, Konto löschen".</P>
          <P>(3) Die Betreiberin kann das Nutzungsverhältnis unter Wahrung einer angemessenen Frist kündigen. Das Recht zur außerordentlichen Kündigung und zur Sperrung nach § 9 bleibt unberührt.</P>
        </Section>

        <Section title="§ 14 Änderungen der Nutzungsbedingungen">
          <P>Die Betreiberin kann diese Nutzungsbedingungen mit Wirkung für die Zukunft ändern, soweit dies aus sachlichem Grund erforderlich ist. Über wesentliche Änderungen werden die Nutzerinnen und Nutzer rechtzeitig informiert. Widerspricht die Nutzerin oder der Nutzer nicht innerhalb einer angemessenen Frist, gelten die geänderten Bedingungen als angenommen. Auf das Widerspruchsrecht und die Folgen wird bei der Information gesondert hingewiesen.</P>
        </Section>

        <Section title="§ 15 Schlussbestimmungen">
          <P>(1) Es gilt das Recht der Bundesrepublik Deutschland.</P>
          <P>(2) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</P>
        </Section>

        <div style={{
          marginTop: 48, padding: '16px 20px', borderRadius: 10,
          background: C.white, border: `1px solid ${C.border}`,
          display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <a href="/datenschutz" style={{ color: C.blue, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            → Datenschutzerklärung
          </a>
          <a href="/impressum" style={{ color: C.blue, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            → Impressum
          </a>
        </div>
      </main>
    </div>
  )
}
