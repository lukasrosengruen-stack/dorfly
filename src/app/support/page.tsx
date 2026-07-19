const C = {
  navy:   '#0D1B2A',
  blue:   '#0057A8',
  green:  '#00A878',
  bg:     '#F4F7FB',
  muted:  '#64748B',
  border: '#DDE6F0',
  white:  '#ffffff',
} as const

export const metadata = {
  title: 'Support – Dorfly',
}

function Logo() {
  return (
    <span
      style={{
        fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em',
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      <span style={{ color: C.blue }}>Dorf</span>
      <span style={{ color: C.navy }}>ly</span>
      <span style={{ color: C.green }}>.</span>
    </span>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: C.navy, lineHeight: 1.7, marginBottom: 10, fontSize: 15 }}>
      {children}
    </p>
  )
}

export default function SupportPage() {
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
        <h1 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 24 }}>
          Support
        </h1>
        <P>
          Fragen oder Probleme mit Dorfly? Wir helfen gerne persönlich per E-Mail.
        </P>
        <P>
          <a href="mailto:hallo@dorfly.de" style={{ color: C.blue, fontWeight: 600 }}>
            hallo@dorfly.de
          </a>
        </P>
      </main>
    </div>
  )
}
