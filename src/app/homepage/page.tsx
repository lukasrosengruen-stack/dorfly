'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Newspaper, MapPin, MessageCircle, BarChart2, Landmark,
  ShoppingBag, Shield, Menu, X, Check, ChevronRight,
} from 'lucide-react'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:   '#0D1B2A',
  blue:   '#0057A8',
  blueM:  '#1A6FC4',
  blueL:  '#60A5FA',
  green:  '#00A878',
  bg:     '#F4F7FB',
  muted:  '#64748B',
  border: '#DDE6F0',
  white:  '#ffffff',
} as const

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ size = 24 }: { size?: number }) {
  return (
    <a
      href="#top"
      style={{
        fontSize: size, fontWeight: 800, letterSpacing: '-0.04em',
        textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
      }}
    >
      <span style={{ color: C.blue }}>Dorf</span>
      <span style={{ color: C.navy }}>ly</span>
      <span style={{
        display: 'inline-block', width: 6, height: 6,
        background: C.green, borderRadius: '50%',
        marginLeft: 2, marginBottom: 10, flexShrink: 0,
      }} />
    </a>
  )
}

// ── Reveal wrapper ─────────────────────────────────────────────────────────────
function R({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`mp-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  )
}

// ── Phone mockup ──────────────────────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 640 }}>
      {/* Float card top-right */}
      <div className="mp-float" style={{
        position: 'absolute', top: 70, right: -10, zIndex: 10,
        background: C.white, borderRadius: 14,
        boxShadow: '0 8px 32px rgba(13,27,42,.12)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, fontWeight: 600, color: C.navy, whiteSpace: 'nowrap',
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📢</div>
        <div>
          <div>Neue Mitteilung</div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>Gemeinde Ehningen</div>
        </div>
      </div>

      {/* Float card bottom-left */}
      <div className="mp-float-delay" style={{
        position: 'absolute', bottom: 140, left: -20, zIndex: 10,
        background: C.white, borderRadius: 14,
        boxShadow: '0 8px 32px rgba(13,27,42,.12)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, fontWeight: 600, color: C.navy, whiteSpace: 'nowrap',
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✅</div>
        <div>
          <div>Mängel gemeldet</div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>In Bearbeitung</div>
        </div>
      </div>

      {/* Phone frame */}
      <div style={{
        width: 290, height: 600, background: C.navy, borderRadius: 46,
        position: 'relative', flexShrink: 0,
        boxShadow: `0 0 0 10px #1A2D43, 0 40px 80px rgba(13,27,42,.3), 0 80px 160px rgba(13,27,42,.12)`,
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 90, height: 26, background: C.navy, borderRadius: 20, zIndex: 10 }} />
        <div style={{ position: 'absolute', inset: 0, background: C.bg, borderRadius: 46, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Status bar */}
          <div style={{ height: 52, background: C.white, display: 'flex', alignItems: 'flex-end', padding: '0 22px 10px', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>9:41</span>
            <span style={{ fontSize: 10, color: C.muted }}>●●●</span>
          </div>
          {/* App header */}
          <div style={{ background: C.white, padding: '10px 18px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.04em' }}>
              <span style={{ color: C.blue }}>Dorf</span>
              <span style={{ color: C.navy }}>ly</span>
              <span style={{ display: 'inline-block', width: 4, height: 4, background: C.green, borderRadius: '50%', marginLeft: 1, marginBottom: 6 }} />
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Guten Morgen, Lisa 👋</div>
          </div>
          {/* Feed */}
          <div style={{ flex: 1, overflow: 'hidden', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: C.white, borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)', flexShrink: 0 }}>
              <div style={{ width: '100%', height: 46, background: `linear-gradient(135deg, ${C.blue}, #003D7A)`, borderRadius: 7, marginBottom: 8 }} />
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.blue, marginBottom: 5 }}>Aktuelles</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, lineHeight: 1.4, marginBottom: 3 }}>Gemeinderatssitzung am 15. Mai</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: C.muted }}>Heute · Ehningen</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#E8F5F0', color: C.green, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 100 }}>
                  <span style={{ width: 4, height: 4, background: C.green, borderRadius: '50%', display: 'inline-block' }} />Neu
                </span>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '1.5px solid #BFDBFE', borderRadius: 12, padding: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, background: C.blue, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.navy }}>Sperrung Hauptstraße</div>
                  <div style={{ fontSize: 10, color: C.muted }}>15.–17. Mai</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
              {[['📋', 'Umfrage', 'Parkplätze'], ['🗺️', 'Mängel', 'Melden']].map(([icon, title, sub]) => (
                <div key={title} style={{ background: C.white, borderRadius: 12, padding: 10, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: 16, marginBottom: 3 }}>{icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.navy }}>{title}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Tab bar */}
          <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px', flexShrink: 0 }}>
            {(['Home', 'News', 'Mängel', 'Mehr'] as const).map((label, i) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: i === 0 ? C.blue : C.border }} />
                <span style={{ fontSize: 8, color: i === 0 ? C.blue : C.muted, fontWeight: i === 0 ? 700 : 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Demo modal ─────────────────────────────────────────────────────────────────
function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', gemeinde: '', email: '', nachricht: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const inputStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontFamily: 'inherit',
    fontSize: 14, color: C.navy, outline: 'none',
    background: C.bg, transition: 'border-color .2s', boxSizing: 'border-box' as const,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(13,27,42,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: C.white, borderRadius: 24, padding: 'clamp(24px, 5vw, 40px)', maxWidth: 480, width: '100%',
        boxShadow: '0 32px 80px rgba(13,27,42,.25)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={28} color={C.green} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: C.navy, marginBottom: 10 }}>Nachricht erhalten!</h3>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65 }}>Wir melden uns persönlich bei Ihnen. Danke für Ihr Interesse an Dorfly.</p>
            <button
              onClick={onClose}
              style={{ marginTop: 24, padding: '12px 28px', background: C.blue, color: C.white, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: C.navy, marginBottom: 6 }}>Demo anfragen</h3>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
              Schreiben Sie uns kurz – wir melden uns persönlich bei Ihnen.
            </p>

            {[
              { id: 'name',     label: 'Ihr Name',       placeholder: 'Vorname Nachname',                type: 'text'  },
              { id: 'gemeinde', label: 'Ihre Gemeinde',   placeholder: 'z.B. Ehningen',                   type: 'text'  },
              { id: 'email',    label: 'E-Mail',          placeholder: 'buergermeister@gemeinde.de',      type: 'email' },
            ].map(({ id, label, placeholder, type }) => (
              <div key={id} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>{label}</label>
                <input
                  type={type}
                  required
                  value={form[id as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.white }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>Nachricht (optional)</label>
              <textarea
                value={form.nachricht}
                onChange={e => setForm(f => ({ ...f, nachricht: e.target.value }))}
                placeholder="Was beschäftigt Sie? Was erhoffen Sie sich von Dorfly?"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.white }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg }}
              />
            </div>

            {status === 'error' && (
              <p style={{ fontSize: 13, color: '#E11D48', marginBottom: 12 }}>Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%', padding: 16, background: status === 'loading' ? C.muted : C.navy,
                color: C.white, border: 'none', borderRadius: 12, fontFamily: 'inherit',
                fontSize: 15, fontWeight: 700, cursor: status === 'loading' ? 'default' : 'pointer',
                letterSpacing: '-0.02em', transition: 'background .2s',
              }}
            >
              {status === 'loading' ? 'Wird gesendet…' : 'Demo anfragen →'}
            </button>
            <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12 }}>
              Kein IT-Projekt. Kein langer Einführungsprozess. Persönlich begleitet.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Eyebrow ────────────────────────────────────────────────────────────────────
function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      color: light ? C.green : C.blue, marginBottom: 20,
    }}>
      <span style={{ display: 'block', width: 16, height: 2, background: C.green, borderRadius: 2, flexShrink: 0 }} />
      {children}
    </div>
  )
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({ onDemo }: { onDemo: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const links = [
    { label: 'Für wen?',   href: '#zielgruppen' },
    { label: 'Funktionen', href: '#features'     },
    { label: 'Setup',      href: '#setup'        },
    { label: 'Über uns',   href: '#about'        },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 68,
      background: scrolled ? 'rgba(244,247,251,.92)' : 'rgba(244,247,251,.7)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
      transition: 'background .3s, border-color .3s',
    }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto', height: '100%',
        padding: '0 clamp(16px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Logo size={22} />

        {/* Desktop links */}
        <ul style={{ display: 'flex', alignItems: 'center', gap: 36, listStyle: 'none', margin: 0, padding: 0 }} className="hidden md:flex">
          {links.map(({ label, href }) => (
            <li key={label}>
              <a
                href={href}
                style={{ fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.navy)}
                onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
              >
                {label}
              </a>
            </li>
          ))}
          <li>
            <button
              onClick={onDemo}
              style={{
                background: C.blue, color: C.white, padding: '10px 22px',
                borderRadius: 100, fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'background .2s, transform .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.blueM; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.transform = 'none' }}
            >
              Demo anfragen
            </button>
          </li>
        </ul>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex md:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.navy, padding: 4 }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 68, left: 0, right: 0,
          background: C.bg, borderBottom: `1px solid ${C.border}`,
          padding: '20px 24px 24px',
        }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {links.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '10px 0', fontSize: 16, fontWeight: 500, color: C.navy, textDecoration: 'none' }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { setMenuOpen(false); onDemo() }}
            style={{
              marginTop: 16, width: '100%', padding: '14px 0', background: C.blue,
              color: C.white, borderRadius: 12, fontFamily: 'inherit',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}
          >
            Demo anfragen
          </button>
        </div>
      )}
    </nav>
  )
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <section id="top" style={{ position: 'relative', overflow: 'hidden', paddingTop: 68 }}>
      <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle,rgba(0,87,168,.07),transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -100, left: -100, width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle,rgba(0,168,120,.05),transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 'clamp(40px, 8vw, 80px) clamp(20px, 5vw, 48px)' }}>
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <R>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: C.white, border: `1px solid ${C.border}`, borderRadius: 100,
                  padding: '6px 14px 6px 8px', fontSize: 12, fontWeight: 700,
                  color: C.blue, letterSpacing: '.06em', textTransform: 'uppercase',
                }}>
                  <span style={{ width: 8, height: 8, background: C.green, borderRadius: '50%', flexShrink: 0 }} />
                  Pilotphase
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Lokal vernetzt.</span>
              </div>
            </R>

            <R delay={0.1}>
              <h1 style={{
                fontSize: 'clamp(36px, 5.5vw, 70px)', fontWeight: 800,
                letterSpacing: '-0.04em', lineHeight: 1.06, color: C.navy, marginBottom: 24,
              }}>
                Deine Gemeinde.<br />
                <span style={{ color: C.blue }}>Dein Smartphone.</span>
              </h1>
            </R>

            <R delay={0.2}>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: C.muted, maxWidth: 480, marginBottom: 40 }}>
                Social Media erreicht nicht alle. Und wenn, dann entscheidet der Algorithmus. Dorfly ist anders. Der direkte, offizielle Kanal zwischen Ihrer Verwaltung und Ihrer Bürgerschaft. Für alle Lebensbereiche Ihrer Kommune. Entwickelt für Gemeinden und Ortsteile bis 15.000 Einwohner.
              </p>
            </R>

            <R delay={0.3}>
              <div className="flex flex-col sm:flex-row" style={{ gap: 14 }}>
                <button
                  onClick={onDemo}
                  style={{
                    padding: '16px 32px', background: C.blue, color: C.white,
                    border: 'none', borderRadius: 12, fontFamily: 'inherit',
                    fontSize: 16, fontWeight: 700, cursor: 'pointer',
                    boxShadow: `0 8px 24px rgba(0,87,168,.3)`,
                    transition: 'background .2s, transform .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.blueM; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.transform = 'none' }}
                >
                  Demo anfragen
                </button>
                <a
                  href="#features"
                  style={{
                    padding: '16px 32px', background: 'transparent', color: C.navy,
                    border: `1.5px solid ${C.border}`, borderRadius: 12, fontFamily: 'inherit',
                    fontSize: 16, fontWeight: 600, textDecoration: 'none',
                    transition: 'border-color .2s, background .2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.background = C.white }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent' }}
                >
                  Mehr erfahren <ChevronRight size={16} />
                </a>
              </div>
            </R>
          </div>

          {/* Right – phone mockup */}
          <R delay={0.15} className="hidden md:block">
            <PhoneMockup />
          </R>
        </div>
      </div>
    </section>
  )
}

// ── ZIELGRUPPEN ───────────────────────────────────────────────────────────────
const zielgruppen = [
  { icon: '🏛️', title: 'Für Bürgermeisterinnen und Bürgermeister', text: 'Endlich ein Kanal, der wirklich ankommt. Ohne Algorithmus. Ohne Streuverlust. Ohne Social Media.',      color: '#EFF6FF' },
  { icon: '🏗️', title: 'Für die Kommunalpolitik',                   text: 'Zeigen Sie Haltung. Erklären Sie Entscheidungen. Bürgernähe wird sichtbar.',                            color: '#F0FDF4' },
  { icon: '🤝', title: 'Für Vereine und Ehrenamt',                  text: 'Eure eigene Bühne. News und Veranstaltungen direkt zu euren Mitgliedern und der ganzen Gemeinde.',       color: '#FFF7ED' },
  { icon: '⚙️', title: 'Für die Verwaltung',                        text: 'DSGVO-konform. In wenigen Tagen einsatzbereit. Kein IT-Projekt.',                                        color: '#F5F3FF' },
]

function Zielgruppen() {
  return (
    <section id="zielgruppen" style={{ background: C.white, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Für jeden in Ihrer Gemeinde</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 64 }}>
            Für jeden in Ihrer Gemeinde.
          </h2>
        </R>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {zielgruppen.map(({ icon, title, text, color }, i) => (
            <R key={title} delay={i * 0.08}>
              <div
                style={{
                  background: C.bg, borderRadius: 22, padding: 32,
                  border: `1.5px solid ${C.border}`, height: '100%',
                  transition: 'border-color .25s, box-shadow .25s, transform .25s',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = C.blue; el.style.boxShadow = '0 16px 48px rgba(0,87,168,.1)'; el.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = C.border; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 20 }}>{icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: C.navy, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: C.muted }}>{text}</p>
              </div>
            </R>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── PROBLEM ───────────────────────────────────────────────────────────────────
function Problem() {
  return (
    <section style={{ padding: 'clamp(64px, 10vw, 120px) 0', background: C.bg }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Das Problem</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 40 }}>
            Das kennen Sie.
          </h2>
        </R>
        <R delay={0.2}>
          <div style={{ fontSize: 18, lineHeight: 1.8, color: C.muted }}>
            <p style={{ marginBottom: 20 }}>
              Social Media erreicht nicht alle. Wenn doch, entscheidet der Algorithmus, wer Ihre Nachricht sieht. Das Mitteilungsblatt ist langsam, kostenintensiv und einseitig. Ihre Gemeinde-Website liest niemand täglich.
            </p>
            <p style={{ marginBottom: 20 }}>
              Sie wissen nicht, wen Sie erreichen. Ihre Bürgerschaft weiß nicht, wohin sie sich wenden soll.
            </p>
            <p style={{ marginBottom: 20 }}>
              Dabei wäre es so einfach. Ein direkter, offizieller Kanal für alle Lebensbereiche Ihrer Kommune. Nicht nur Sie zu Ihrer Bürgerschaft. Sondern auch Ihre Bürgerschaft zu Ihnen.
            </p>
            <p style={{ fontWeight: 700, color: C.navy, fontSize: 20 }}>Das ist Dorfly.</p>
          </div>
        </R>
      </div>
    </section>
  )
}

// ── FEATURES ──────────────────────────────────────────────────────────────────
const features = [
  { icon: <Newspaper size={22} color={C.blue}    />, iconBg: '#EFF6FF', title: 'Newsfeed',           text: 'Amtliche Mitteilungen, Vereinsnews und lokale Angebote. Strukturiert. Direkt aufs Smartphone. Ihre Bürgerschaft sieht nur, was sie wirklich interessiert.' },
  { icon: <MapPin     size={22} color={C.green}   />, iconBg: '#F0FDF4', title: 'Mängelmelder',       text: 'Schäden melden mit GPS und Foto. Direkt an die Verwaltung. Kein Anruf. Kein Formular. Kein Umweg.' },
  { icon: <MessageCircle size={22} color="#F59E0B" />, iconBg: '#FFF7ED', title: 'Frag die Gemeinde', text: 'Der direkte Draht zwischen Bürgerschaft und Verwaltung. Fragen werden gestellt, beantwortet und für alle sichtbar gemacht.' },
  { icon: <BarChart2  size={22} color="#7C3AED"   />, iconBg: '#F5F3FF', title: 'Bürgerbeteiligung', text: 'Umfragen und Abstimmungen. Für alle oder nur für verifizierte Einwohnerinnen und Einwohner Ihrer Kommune. Sie entscheiden.' },
  { icon: <Landmark   size={22} color="#E11D48"   />, iconBg: '#FFF1F2', title: 'Kommunalpolitik',   text: 'Gemeinderatsfraktionen kommunizieren direkt mit der Bürgerschaft. Entscheidungen werden nachvollziehbar.' },
  { icon: <ShoppingBag size={22} color="#0EA5E9"  />, iconBg: '#F0F9FF', title: 'Lokale Angebote',   text: 'Vom Erdbeerbauern bis zum Friseur. Hyperlokale Angebote, die aktiv abonniert werden. Kein Spam. Kein Algorithmus.' },
]

function Features() {
  return (
    <section id="features" style={{ background: C.white, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Funktionen</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 12 }}>
            Alles, was Ihre Gemeinde braucht. In einer App.
          </h2>
        </R>
        <R delay={0.2}>
          <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.65, maxWidth: 560, marginBottom: 64 }}>
            Dorfly ist die offizielle digitale Heimat Ihrer Kommune.
          </p>
        </R>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon, iconBg, title, text }, i) => (
            <R key={title} delay={(i % 3) * 0.08}>
              <div
                style={{
                  background: C.bg, borderRadius: 22, padding: 32,
                  border: `1.5px solid ${C.border}`, height: '100%',
                  transition: 'border-color .25s, box-shadow .25s, transform .25s',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = C.blue; el.style.boxShadow = '0 16px 48px rgba(0,87,168,.1)'; el.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = C.border; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>{icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: C.navy, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: C.muted }}>{text}</p>
              </div>
            </R>
          ))}
        </div>

        {/* DSGVO – featured full-width card */}
        <R delay={0.1}>
          <div style={{
            marginTop: 20, background: C.navy, borderRadius: 22,
            padding: 'clamp(24px, 4vw, 36px) clamp(20px, 4vw, 40px)',
            display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={26} color={C.blueL} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: C.white, marginBottom: 10 }}>Datenschutz by Design</h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: '#94A3B8' }}>
                Bewusst schlankes Nutzerprofil. Kein Tracking. Keine Nutzeranalyse. Keine Weitergabe an Dritte. Alle Daten auf EU-Servern.{' '}
                <span style={{ color: C.white, fontWeight: 600 }}>Das Argument, das Ihren Datenschutzbeauftragten überzeugt.</span>
              </p>
            </div>
          </div>
        </R>
      </div>
    </section>
  )
}

// ── SETUP & BEGLEITUNG ────────────────────────────────────────────────────────
const steps = [
  { num: '01', title: 'Zugang erhalten.',    text: 'Ihre Gemeinde wird eingerichtet. Farben, Logo, Struktur. Alles auf Ihre Kommune zugeschnitten.',                                    accent: true  },
  { num: '02', title: 'Alle einbinden.',     text: 'Vereine, Kirchen, Organisationen und Kommunalpolitik werden persönlich begleitet. Jeder bekommt seine Rolle.',                      accent: false },
  { num: '03', title: 'Reichweite aufbauen.', text: 'Wir entwickeln eine Strategie, damit Ihre Bürgerschaft die App wirklich nutzt. Nicht nur herunterlädt.',                           accent: false },
]

function Setup() {
  return (
    <section id="setup" style={{ background: C.bg, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Setup & Begleitung</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 12 }}>
            In wenigen Tagen live. Nicht in Monaten.
          </h2>
        </R>
        <R delay={0.2}>
          <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, maxWidth: 700, marginBottom: 72 }}>
            Kommunale IT-Projekte dauern oft Jahre. Dorfly nicht.<br /><br />
            Wir lassen Sie nicht allein. Unser Anspruch geht über die Software hinaus. Dorfly soll der reichweitenstärkste Kommunikationskanal in Ihrer Gemeinde werden. Für Verwaltung, Kommunalpolitik, Vereine, Organisationen und Kirchen. Diesen Weg gehen wir gemeinsam mit Ihnen.
          </p>
        </R>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {steps.map(({ num, title, text, accent }, i) => (
            <R key={num} delay={i * 0.1}>
              <div>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, marginBottom: 24,
                  border: accent ? 'none' : `1.5px solid ${C.border}`,
                  background: accent ? C.blue : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em',
                  color: accent ? C.white : '#CBD5E1',
                }}>
                  {num}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: C.navy, letterSpacing: '-0.03em', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: C.muted }}>{text}</p>
              </div>
            </R>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── ÜBER UNS ──────────────────────────────────────────────────────────────────
function About() {
  return (
    <section id="about" style={{ background: C.navy, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-24 items-start">
          {/* Left – story */}
          <div>
            <R><Eyebrow light>Über Dorfly</Eyebrow></R>
            <R delay={0.1}>
              <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.white, marginBottom: 32 }}>
                Von einem Bürgermeister.<br />Für Bürgermeister.
              </h2>
            </R>
            <R delay={0.2}>
              <div style={{ fontSize: 17, lineHeight: 1.8, color: '#94A3B8' }}>
                <p style={{ marginBottom: 20 }}>
                  Als ich 2020 Bürgermeister von Ehningen wurde, hatte ich einen klaren Wunsch.{' '}
                  <strong style={{ color: C.white }}>Einen direkten, offiziellen Kanal zu meinen Bürgerinnen und Bürgern.</strong>
                </p>
                <p style={{ marginBottom: 20 }}>
                  Ich habe den Markt analysiert. Es gibt viele gute Ansätze. Aber keiner hat wirklich das geboten, was wir als Gemeinde brauchen. Die einen wollen ein soziales Netzwerk sein. Die anderen denken vom Bürger her, aber nicht von der Verwaltung. Und so haben wir jahrelang Kompromisse gemacht.
                </p>
                <p style={{ marginBottom: 20 }}>
                  Irgendwann hatte ich genug. Das Gefühl, unter unseren Möglichkeiten zu bleiben, hat mich angetrieben. Ich kenne Verwaltung und kommunikative Herausforderungen täglich aus erster Hand. Und ich weiß genau, was eine Gemeinde-App wirklich leisten muss.
                </p>
                <p style={{ marginBottom: 20 }}>
                  Dorfly ist in der Pilotphase. Wir suchen Bürgermeisterinnen und Bürgermeister, die von Anfang an dabei sind. Die ehrliches Feedback geben. Die mitgestalten. Denn Ihr Input von heute ist vielleicht das Feature von morgen.
                </p>
                <p style={{ color: C.white, fontWeight: 600 }}>
                  Seien Sie dabei. Gemeinsam bauen wir den reichweitenstärksten Kanal für Ihre Gemeinde.
                </p>
              </div>
            </R>
          </div>

          {/* Right – founder card */}
          <R delay={0.2}>
            <div style={{
              background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.1)',
              borderRadius: 24, padding: 40,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.blue}, #003D7A)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: '-0.04em',
                marginBottom: 24,
              }}>
                LR
              </div>

              <p style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em', color: C.white, lineHeight: 1.5, marginBottom: 24, fontStyle: 'italic' }}>
                <span style={{ color: C.green, fontSize: 32, lineHeight: 0, verticalAlign: '-10px', marginRight: 4 }}>„</span>
                Jede Gemeinde verdient einen direkten Kanal zu ihren Bürgern. Nicht über Umwege. Direkt.
              </p>

              <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 24, marginBottom: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.blueL }}>Lukas Rosengrün</div>
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Bürgermeister der Gemeinde Ehningen und Gründer von Dorfly</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Bürger, die wirklich informiert sind',
                  'Gemeinden, die weniger Arbeit haben',
                  'Demokratie, die im Alltag spürbar ist',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#64748B' }}>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>→</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </R>
        </div>
      </div>
    </section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function CTA({ onDemo }: { onDemo: () => void }) {
  return (
    <section style={{ padding: 'clamp(40px, 8vw, 80px) clamp(20px, 5vw, 48px) clamp(64px, 10vw, 120px)' }}>
      <div style={{ maxWidth: 1224, margin: '0 auto' }}>
        <div style={{
          background: C.navy, borderRadius: 32, padding: 'clamp(48px, 6vw, 80px) clamp(32px, 5vw, 80px)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, rgba(0,87,168,.45), transparent 65%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <R>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.green, marginBottom: 20 }}>
                <span style={{ display: 'block', width: 16, height: 2, background: C.green, borderRadius: 2 }} />
                Pilotphase – jetzt einsteigen
              </div>
            </R>
            <R delay={0.1}>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 56px)', fontWeight: 800, letterSpacing: '-0.04em', color: C.white, lineHeight: 1.08, margin: '0 0 18px' }}>
                Bürgernähe, die kein Versprechen bleibt.
              </h2>
            </R>
            <R delay={0.2}>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: '#64748B', maxWidth: 560, margin: '0 auto 44px' }}>
                Jede Bürgermeisterin und jeder Bürgermeister möchte nah an den Menschen sein. In die Gemeinde reinhören. Im echten Austausch mit der Bürgerschaft stehen.<br /><br />
                Dorfly macht daraus mehr als ein Versprechen. Seien Sie eine der ersten Kommunen, die diesen Weg gehen.
              </p>
            </R>
            <R delay={0.3}>
              <button
                onClick={onDemo}
                style={{
                  padding: '18px 44px', background: C.green, color: C.white,
                  border: 'none', borderRadius: 14, fontFamily: 'inherit',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0,168,120,.35)',
                  transition: 'background .2s, transform .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#00C99A'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = C.green; e.currentTarget.style.transform = 'none' }}
              >
                Demo anfragen
              </button>
              <p style={{ fontSize: 13, color: '#475569', marginTop: 16 }}>
                Kein IT-Projekt. Kein langer Einführungsprozess. Persönlich begleitet.
              </p>
            </R>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: 'clamp(32px, 6vw, 48px) clamp(20px, 5vw, 48px)' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Logo size={20} />
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 500, paddingLeft: 2 }}>Lokal vernetzt.</span>
        </div>
        <ul style={{ display: 'flex', gap: 32, listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
          {[
            { label: 'Impressum',     href: '/impressum'       },
            { label: 'Datenschutz',   href: '/datenschutz'     },
            { label: 'Für Gemeinden', href: '#zielgruppen'     },
            { label: 'Kontakt',       href: 'mailto:hallo@dorfly.de' },
          ].map(({ label, href }) => (
            <li key={label}>
              <a
                href={href}
                style={{ fontSize: 13, color: C.muted, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.navy)}
                onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <span style={{ fontSize: 13, color: '#CBD5E1' }}>© 2026 Dorfly</span>
      </div>
    </footer>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function HomepagePage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="mp" style={{ scrollBehavior: 'smooth' }}>
      <Nav onDemo={() => setModalOpen(true)} />
      <main>
        <Hero    onDemo={() => setModalOpen(true)} />
        <Zielgruppen />
        <Problem />
        <Features />
        <Setup />
        <About />
        <CTA     onDemo={() => setModalOpen(true)} />
      </main>
      <Footer />
      {modalOpen && <DemoModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
