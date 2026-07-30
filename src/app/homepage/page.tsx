'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Newspaper, MapPin, MessageCircle, BarChart2, Landmark,
  ShoppingBag, Shield, Menu, X, Check, ChevronRight,
  AlertTriangle, Trash2, Bell,
} from 'lucide-react'
import { Logo as Wordmark } from '@/components/ui'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const APP_STORE_URL = 'https://apps.apple.com/de/app/dorfly/id6791239032'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:           '#0D1B2A',
  blue:           '#0057A8',
  blueM:          '#1A6FC4',
  blueL:          '#60A5FA',
  green:          '#00A878',
  greenText:      '#006A4C', // darker green for white text/badges — #00A878 fails 4.5:1 with white
  greenTextHover: '#00805A',
  bg:     '#F4F7FB',
  muted:  '#64748B',
  border: '#DDE6F0',
  white:  '#ffffff',
} as const

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ size = 24 }: { size?: number }) {
  return (
    <a href="#top" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      <Wordmark size={size} />
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

// ── Phone frame (screenshot container) ────────────────────────────────────────
// Screenshots bringen den Gerätrahmen bereits selbst mit (transparentes PNG, 1464×2978px).
// Padding reserviert Raum für den drop-shadow, damit er nicht abgeschnitten wird.
function PhoneFrame({ src, alt, width = 290 }: { src: string; alt: string; width?: number }) {
  const pad = Math.round(width * 0.05)
  return (
    <div style={{
      width, aspectRatio: '1464 / 2978', boxSizing: 'border-box',
      padding: pad, flexShrink: 0,
    }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Image
          src={src}
          alt={alt}
          fill
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 18px 26px rgba(13,27,42,.25))' }}
          sizes={`${width}px`}
        />
      </div>
    </div>
  )
}

// ── Phone mockup ──────────────────────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 640 }}>
      <PhoneFrame
        src="/screenshots/home-portrait.png"
        alt="Startbildschirm der Dorfly-Demo-Gemeinde Musterbach mit Gemeindewappen und aktiver Warnmeldung"
      />
    </div>
  )
}

// ── Demo modal ─────────────────────────────────────────────────────────────────
function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', gemeinde: '', email: '', nachricht: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const containerRef = useFocusTrap(true)
  const headingId = 'demo-modal-heading'

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
    fontSize: 16, color: C.navy, outline: 'none', // 16px avoids iOS Safari's auto-zoom on focus
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
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{
          background: C.white, borderRadius: 24, padding: 'clamp(24px, 5vw, 40px)', maxWidth: 480, width: '100%',
          boxShadow: '0 32px 80px rgba(13,27,42,.25)', position: 'relative',
          maxHeight: '90vh', overflowY: 'auto',
        }}>
        <button
          onClick={onClose}
          aria-label="Schließen"
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div role="status" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={28} color={C.green} />
            </div>
            <h3 id={headingId} style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: C.navy, marginBottom: 10 }}>Nachricht erhalten.</h3>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65 }}>Ich melde mich gerne persönlich bei Ihnen.</p>
            <button
              onClick={onClose}
              style={{ marginTop: 24, padding: '12px 28px', background: C.blue, color: C.white, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 id={headingId} style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: C.navy, marginBottom: 6 }}>Demo anfragen</h3>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
              Schreiben Sie mir kurz. Ich melde mich gerne persönlich bei Ihnen.
            </p>

            {[
              { id: 'name',     label: 'Ihr Name',       placeholder: 'Vorname Nachname',                type: 'text'  },
              { id: 'gemeinde', label: 'Ihre Gemeinde',   placeholder: 'z.B. Ehningen',                   type: 'text'  },
              { id: 'email',    label: 'E-Mail',          placeholder: 'buergermeister@gemeinde.de',      type: 'email' },
            ].map(({ id, label, placeholder, type }) => (
              <div key={id} style={{ marginBottom: 14 }}>
                <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>{label}</label>
                <input
                  id={id}
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
              <label htmlFor="demo-nachricht" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>Nachricht (optional)</label>
              <textarea
                id="demo-nachricht"
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
              <p role="alert" style={{ fontSize: 13, color: '#E11D48', marginBottom: 12 }}>Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.</p>
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
              {status === 'loading' ? 'Wird gesendet...' : 'Senden'}
            </button>
            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 12 }}>
              Unverbindlich. Kein IT-Projekt. Kein langer Einführungsprozess.
            </p>
            <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
              Ihre Angaben werden ausschließlich zur Bearbeitung dieser Anfrage verwendet.{' '}
              <a href="/datenschutz" style={{ color: C.muted, textDecoration: 'underline' }}>Mehr in der Datenschutzerklärung.</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Updates modal ─────────────────────────────────────────────────────────────
function UpdatesModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ vorname: '', nachname: '', email: '', gemeinde: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const containerRef = useFocusTrap(true)
  const headingId = 'updates-modal-heading'

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
      const res = await fetch('/api/newsletter', {
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
    fontSize: 16, color: C.navy, outline: 'none', // 16px avoids iOS Safari's auto-zoom on focus
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
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{
          background: C.white, borderRadius: 24, padding: 'clamp(24px, 5vw, 36px)', maxWidth: 420, width: '100%',
          boxShadow: '0 32px 80px rgba(13,27,42,.25)', position: 'relative',
          maxHeight: '90vh', overflowY: 'auto',
        }}>
        <button
          onClick={onClose}
          aria-label="Schließen"
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div role="status" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={28} color={C.green} />
            </div>
            <h3 id={headingId} style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: C.navy, marginBottom: 10 }}>Eingetragen.</h3>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65 }}>Sie erhalten gleich eine E-Mail zur Bestätigung.</p>
            <button
              onClick={onClose}
              style={{ marginTop: 24, padding: '12px 28px', background: C.blue, color: C.white, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 id={headingId} style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: C.navy, marginBottom: 6 }}>Auf dem Laufenden bleiben</h3>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
              Ich informiere Sie, wenn es Wichtiges zu Dorfly gibt. Höchstens ein paar Mal im Jahr.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                { id: 'vorname', label: 'Vorname', placeholder: 'Vorname' },
                { id: 'nachname', label: 'Nachname', placeholder: 'Nachname' },
              ].map(({ id, label, placeholder }) => (
                <div key={id}>
                  <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>{label}</label>
                  <input
                    id={id}
                    type="text"
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
            </div>

            {[
              { id: 'email',    label: 'E-Mail',             placeholder: 'ihre@email.de',  type: 'email', required: true  },
              { id: 'gemeinde', label: 'Gemeinde (optional)', placeholder: 'z.B. Ehningen', type: 'text',  required: false },
            ].map(({ id, label, placeholder, type, required }) => (
              <div key={id} style={{ marginBottom: 14 }}>
                <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' as const }}>{label}</label>
                <input
                  id={id}
                  type={type}
                  required={required}
                  value={form[id as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.white }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg }}
                />
              </div>
            ))}

            {status === 'error' && (
              <p role="alert" style={{ fontSize: 13, color: '#E11D48', marginBottom: 12 }}>Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%', padding: 14, background: status === 'loading' ? C.muted : C.navy,
                color: C.white, border: 'none', borderRadius: 12, fontFamily: 'inherit',
                fontSize: 15, fontWeight: 700, cursor: status === 'loading' ? 'default' : 'pointer',
                letterSpacing: '-0.02em', transition: 'background .2s',
              }}
            >
              {status === 'loading' ? 'Wird eingetragen...' : 'Eintragen'}
            </button>
            <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
              Mit dem Eintragen willigen Sie ein, dass wir Ihre E-Mail-Adresse zum Versand von Updates zu Dorfly verwenden. Sie können sich jederzeit per Link in jeder E-Mail abmelden.{' '}
              <a href="/datenschutz" style={{ color: C.muted, textDecoration: 'underline' }}>Mehr in der Datenschutzerklärung.</a>
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

// ── Group label (sub-cluster heading within a card grid) ──────────────────────
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: C.navy,
      marginBottom: 20, paddingBottom: 10, borderBottom: `1.5px solid ${C.border}`,
    }}>
      {children}
    </h3>
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
    { label: 'Für wen?',    href: '#zielgruppen' },
    { label: 'Funktionen',  href: '#features'     },
    { label: 'Setup',       href: '#setup'        },
    { label: 'Über Dorfly', href: '#about'        },
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
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.navy, padding: 4 }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div id="mobile-nav-menu" style={{
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
            <R delay={0.1}>
              <h1 style={{
                fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 800,
                letterSpacing: '-0.04em', lineHeight: 1.04, color: C.navy, marginBottom: 12,
              }}>
                Lokal vernetzt.
              </h1>
            </R>

            <R delay={0.15}>
              <h2 style={{
                fontSize: 'clamp(22px, 3vw, 38px)', fontWeight: 700,
                letterSpacing: '-0.03em', lineHeight: 1.2, color: C.blue, marginBottom: 28,
              }}>
                Ihre Gemeinde. In einer App.
              </h2>
            </R>

            <R delay={0.2}>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: C.muted, maxWidth: 480, marginBottom: 40 }}>
                Dorfly ist der offizielle digitale Kanal Ihrer Gemeinde. Verwaltung, Kommunalpolitik, Vereine und lokales Gewerbe an einem Ort. Strukturiert. Direkt. Für alle, die hier leben. Entwickelt für kleine und mittlere Kommunen, mit Schwerpunkt auf Gemeinden und Ortsteilen bis 15.000 Einwohner.
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

            <R delay={0.35}>
              <div style={{ marginTop: 32 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>
                  Jetzt verfügbar
                </div>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Dorfly im App Store – öffnet in neuem Tab"
                  style={{ display: 'inline-block' }}
                >
                  <img src="/badges/app-store-de.svg" alt="Download on the App Store" height={44} style={{ display: 'block' }} />
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

// ── PROBLEM ───────────────────────────────────────────────────────────────────
function Problem() {
  return (
    <section style={{ padding: 'clamp(64px, 10vw, 120px) 0', background: C.bg }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Das Problem</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 40 }}>
            Viele Kanäle. Keine Heimat.
          </h2>
        </R>
        <R delay={0.2}>
          <div style={{ fontSize: 18, lineHeight: 1.8, color: C.muted }}>
            <p style={{ marginBottom: 20 }}>
              Sie kommunizieren über Homepage, Mitteilungsblatt, Social Media, E-Mail und Telefon. Jeder Kanal hat seinen Platz. Aber niemand weiß, wo etwas zu finden ist. Manches geht unter. Manches erreicht nicht die Richtigen. Auf Social Media entscheidet der Algorithmus, wer Ihre Nachricht sieht.
            </p>
            <p style={{ marginBottom: 20 }}>
              Dorfly ersetzt diese Kanäle nicht. Dorfly bündelt das, was wirklich relevant ist, an einem Ort. Strukturiert. Offiziell. Für alle Lebensbereiche Ihrer Gemeinde.
            </p>
            <p style={{ marginBottom: 20 }}>
              Nicht nur Sie zu Ihrer Bürgerschaft. Sondern auch Ihre Bürgerschaft zu Ihnen.
            </p>
            <p style={{ fontWeight: 700, color: C.navy, fontSize: 20 }}>Das ist Dorfly.</p>
          </div>
        </R>
      </div>
    </section>
  )
}

// ── ZIELGRUPPEN ───────────────────────────────────────────────────────────────
const zielgruppenGruppen = [
  { key: 'verwaltung',   label: 'Verwaltung und Politik' },
  { key: 'buergerschaft', label: 'Bürgerschaft und lokales Leben' },
] as const

const zielgruppen = [
  {
    group: 'verwaltung',
    icon: '🏛️', color: '#EFF6FF',
    title: 'Bürgermeisterinnen und Bürgermeister',
    text: 'Endlich ein Kanal, der wirklich ankommt. Ohne Algorithmus. Ohne Streuverlust. Ohne Social Media. Auch im Ernstfall erreichen Sie Ihre Bürgerschaft direkt.',
  },
  {
    group: 'verwaltung',
    icon: '🏗️', color: '#F0FDF4',
    title: 'Gemeinderat',
    text: 'Eine eigene Bühne für Fraktionen und einzelne Mandatsträger. Entscheidungen werden nachvollziehbar. Demokratie wird im Alltag sichtbar.',
  },
  {
    group: 'verwaltung',
    icon: '⚙️', color: '#F5F3FF',
    title: 'Verwaltung',
    text: 'DSGVO-konform. In wenigen Tagen einsatzbereit. Kein IT-Projekt.',
  },
  {
    group: 'buergerschaft',
    icon: '👥', color: '#FFF7ED',
    title: 'Bürgerinnen und Bürger',
    text: 'Alles aus dem Ort in einer App. Vom Festle bis zur Erinnerung an die Mülltonne. Direkter Kontakt zu Mandatsträgern. Vereinsnachrichten und Angebote vom Hofladen direkt aufs Handy. Persönlich anpassbar. Nichts verpassen, was wirklich relevant ist.',
  },
  {
    group: 'buergerschaft',
    icon: '🤝', color: '#F0FDF4',
    title: 'Vereine und Ehrenamt',
    text: 'Sichtbarkeit für News und Veranstaltungen. Direkt zu Mitgliedern und der ganzen Gemeinde. Eine neue Bühne, auch für die Mitgliedergewinnung.',
  },
  {
    group: 'buergerschaft',
    icon: '🛒', color: '#EFF6FF',
    title: 'Lokales Gewerbe',
    text: 'Sichtbarkeit im Ort. Hyperlokal. Direkt bei den Menschen, die hier leben, arbeiten und einkaufen.',
  },
]

function Zielgruppen() {
  return (
    <section id="zielgruppen" style={{ background: C.white, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Für alle in Ihrer Gemeinde</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 64 }}>
            Für alle in Ihrer Gemeinde.
          </h2>
        </R>
        {zielgruppenGruppen.map((gruppe, gi) => (
          <div key={gruppe.key} style={{ marginBottom: gi < zielgruppenGruppen.length - 1 ? 48 : 0 }}>
            <R delay={0.05}><GroupLabel>{gruppe.label}</GroupLabel></R>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {zielgruppen.filter(z => z.group === gruppe.key).map(({ icon, title, text, color }, i) => (
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
        ))}
      </div>
    </section>
  )
}

// ── FEATURES ──────────────────────────────────────────────────────────────────
const featureGruppen = [
  { key: 'kommunikation', label: 'Kommunikation und Mitsprache' },
  { key: 'information',   label: 'Information und Sicherheit' },
  { key: 'alltag',        label: 'Alltag und Service' },
] as const

const features = [
  {
    group: 'kommunikation',
    icon: <Landmark     size={22} color="#E11D48"   />, iconBg: '#FFF1F2',
    title: 'Kommunalpolitik',
    text: 'Eine eigene Bühne für Gemeinderatsfraktionen und einzelne Mandatsträger. Entscheidungen werden erklärt. Positionen werden sichtbar. Bürger können gezielt Fragen an einzelne Ratsmitglieder stellen, direkt und nachvollziehbar. Demokratie findet im Alltag statt, nicht nur im Ratssaal.',
    badge: true,
  },
  {
    group: 'kommunikation',
    icon: <BarChart2    size={22} color="#7C3AED"   />, iconBg: '#F5F3FF',
    title: 'Bürgerbeteiligung',
    text: 'Umfragen und Abstimmungen. Für alle oder nur für verifizierte Einwohnerinnen und Einwohner Ihrer Kommune. Sie entscheiden, wer mitgestaltet.',
    badge: false,
  },
  {
    group: 'kommunikation',
    icon: <MessageCircle size={22} color="#0EA5E9"  />, iconBg: '#F0F9FF',
    title: 'Frag den Bürgermeister',
    text: 'Der direkte Draht zwischen Bürgerschaft und Verwaltung. Fragen werden gestellt, beantwortet und für alle sichtbar gemacht.',
    badge: false,
  },
  {
    group: 'information',
    icon: <Newspaper    size={22} color={C.blue}    />, iconBg: '#EFF6FF',
    title: 'Newsfeed',
    text: 'Amtliche Mitteilungen, Vereinsnews, Veranstaltungen und Angebote aus dem lokalen Gewerbe. Strukturiert. Direkt aufs Smartphone. Ihre Bürgerschaft sieht nur, was sie wirklich interessiert.',
    badge: false,
  },
  {
    group: 'information',
    icon: <AlertTriangle size={22} color="#F59E0B"  />, iconBg: '#FFFBEB',
    title: 'Krisenkommunikation',
    text: 'Im Ernstfall sofort die richtige Information an die richtigen Menschen. Push-Benachrichtigung an die ganze Gemeinde oder gezielt an Ortsteile. Offizieller Absender. Keine Gerüchte.',
    badge: false,
  },
  {
    group: 'alltag',
    icon: <MapPin        size={22} color={C.green}  />, iconBg: '#F0FDF4',
    title: 'Mängelmelder',
    text: 'Schäden melden mit GPS und Foto. Direkt an die Verwaltung. Kein Anruf. Kein Formular. Kein Umweg.',
    badge: false,
  },
  {
    group: 'alltag',
    icon: <Trash2        size={22} color="#64748B"  />, iconBg: '#F8FAFC',
    title: 'Abfallkalender',
    text: 'Termine für Restmüll, Bio, Papier und Gelben Sack. Personalisiert auf das, was bei Ihnen abgeholt wird. Mit Erinnerung am Vorabend. Schluss mit Suchen und Vergessen.',
    badge: false,
  },
  {
    group: 'alltag',
    icon: <ShoppingBag   size={22} color="#0EA5E9"  />, iconBg: '#F0F9FF',
    title: 'Lokales Gewerbe',
    text: 'Vom Erdbeerbauern bis zum Friseur. Hyperlokale Angebote, die aktiv abonniert werden. Sichtbarkeit für Ihre Wirtschaft. Kein Spam. Kein Algorithmus.',
    badge: false,
  },
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

        {featureGruppen.map((gruppe, gi) => (
          <div key={gruppe.key} style={{ marginBottom: gi < featureGruppen.length - 1 ? 48 : 20 }}>
            <R delay={0.05}><GroupLabel>{gruppe.label}</GroupLabel></R>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.filter(f => f.group === gruppe.key).map(({ icon, iconBg, title, text, badge }, i) => (
                <R key={title} delay={(i % 3) * 0.08}>
                  <div
                    style={{
                      background: C.bg, borderRadius: 22, padding: 32,
                      border: `1.5px solid ${C.border}`, height: '100%',
                      position: 'relative', overflow: 'hidden',
                      transition: 'border-color .25s, box-shadow .25s, transform .25s',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = C.blue; el.style.boxShadow = '0 16px 48px rgba(0,87,168,.1)'; el.style.transform = 'translateY(-4px)' }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = C.border; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
                  >
                    {badge && (
                      <div style={{
                        position: 'absolute', top: 16, right: 16,
                        background: C.greenText, color: C.white,
                        fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                        padding: '4px 10px', borderRadius: 100,
                      }}>
                        Einzigartig in Dorfly
                      </div>
                    )}
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>{icon}</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: C.navy, marginBottom: 8 }}>{title}</h3>
                    <p style={{ fontSize: 15, lineHeight: 1.65, color: C.muted }}>{text}</p>
                  </div>
                </R>
              ))}
            </div>
          </div>
        ))}

        {/* Datenschutz – featured full-width card */}
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
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: C.white, marginBottom: 10 }}>Datenschutz und Barrierefreiheit</h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: '#94A3B8' }}>
                Bewusst schlankes Nutzerprofil. Kein Tracking. Keine Nutzeranalyse. Keine Weitergabe an Dritte. Alle Daten auf EU-Servern. Kommunen sind nach BGG, BITV 2.0 und BFSG verpflichtet, digitale Angebote barrierefrei bereitzustellen. Dorfly ist auf WCAG 2.2 AA ausgerichtet. Die Erklärung zur Barrierefreiheit ist für jede Gemeinde inklusive.{' '}
                <span style={{ color: C.white, fontWeight: 600 }}>Die Argumente, die Ihren Datenschutzbeauftragten und Ihre IT überzeugen.</span>
              </p>
            </div>
          </div>
        </R>
      </div>
    </section>
  )
}

// ── DEMO SHOWCASE ─────────────────────────────────────────────────────────────
const showcaseScreenshots = [
  { src: '/screenshots/gemeinderat-portrait.png', alt: 'Übersicht der Gemeinderätinnen und Gemeinderäte in Musterbach' },
  { src: '/screenshots/maengelmelder-portrait.png', alt: 'Mängelmelder mit Statusverfolgung und Antworten der Verwaltung' },
  { src: '/screenshots/abfallkalender-portrait.png', alt: 'Abfallkalender mit Abholterminen und Erinnerungen' },
  { src: '/screenshots/newsfeed-portrait.png', alt: 'Newsfeed mit Beiträgen von Verwaltung und Vereinen' },
]

function DemoShowcase() {
  return (
    <section style={{ background: C.white, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 64, textAlign: 'center' }}>
            Einblicke aus der Demo-Gemeinde Musterbach
          </h2>
        </R>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
          {showcaseScreenshots.map(({ src, alt }, i) => (
            <R key={src} delay={i * 0.08}>
              <PhoneFrame src={src} alt={alt} width={230} />
            </R>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── SETUP & BEGLEITUNG ────────────────────────────────────────────────────────
const steps = [
  { num: '01', title: 'Zugang erhalten.',    text: 'Ihre Gemeinde wird eingerichtet. Farben, Logo, Struktur. Alles auf Ihre Kommune zugeschnitten.',                                    accent: true  },
  { num: '02', title: 'Alle einbinden.',     text: 'Vereine, Kirchen, lokales Gewerbe und Kommunalpolitik werden persönlich begleitet. Jede Gruppe bekommt ihre Rolle.',                 accent: false },
  { num: '03', title: 'Reichweite aufbauen.', text: 'Wir entwickeln eine Strategie, damit Ihre Bürgerschaft die App wirklich nutzt. Nicht nur herunterlädt.',                           accent: false },
]

function Setup() {
  return (
    <section id="setup" style={{ background: C.bg, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Setup und Begleitung</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 12 }}>
            In wenigen Tagen live. Nicht in Monaten.
          </h2>
        </R>
        <R delay={0.2}>
          <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, maxWidth: 700, marginBottom: 72 }}>
            Kommunale IT-Projekte dauern oft Jahre. Dorfly nicht.<br /><br />
            Wir lassen Sie nicht allein. Unser Anspruch geht über die Software hinaus. Dorfly soll der reichweitenstärkste Kommunikationskanal in Ihrer Gemeinde werden. Für Verwaltung, Kommunalpolitik, Vereine, lokales Gewerbe und Kirchen. Diesen Weg gehen wir gemeinsam mit Ihnen.
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

// ── ÜBER DORFLY ───────────────────────────────────────────────────────────────
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
                Von einem amtierenden Bürgermeister. Für die Verwaltung und alle, die Teil ihrer Gemeinde sind.
              </h2>
            </R>
            <R delay={0.2}>
              <div style={{ fontSize: 17, lineHeight: 1.8, color: '#94A3B8' }}>
                <p style={{ marginBottom: 20 }}>
                  Als ich 2020 Bürgermeister von Ehningen wurde, hatte ich einen klaren Wunsch.{' '}
                  <strong style={{ color: C.white }}>Einen direkten, offiziellen Kanal zu meiner Bürgerschaft.</strong>
                </p>
                <p style={{ marginBottom: 20 }}>
                  Ich habe den Markt analysiert. Es gibt viele gute Ansätze. Aber keiner hat wirklich das geboten, was wir als Gemeinde brauchen. Die einen wollen ein soziales Netzwerk sein. Die anderen denken vom Bürger her, aber nicht von der Verwaltung. Und so haben wir jahrelang Kompromisse gemacht.
                </p>
                <p style={{ marginBottom: 20 }}>
                  Irgendwann hatte ich genug. Das Gefühl, unter unseren Möglichkeiten zu bleiben, hat mich angetrieben. Ich kenne Verwaltung und kommunikative Herausforderungen täglich aus erster Hand. Und ich weiß genau, was eine Gemeinde-App wirklich leisten muss.
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
              <Image
                src="/lukas-rosengruen.jpg"
                alt="Lukas Rosengrün, Bürgermeister der Gemeinde Ehningen"
                width={120}
                height={120}
                priority={false}
                style={{
                  width: 120, height: 120, borderRadius: '50%',
                  objectFit: 'cover', objectPosition: 'center top',
                  marginBottom: 24, display: 'block',
                }}
              />

              <p style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: C.white, lineHeight: 1.5, marginBottom: 24, fontStyle: 'italic' }}>
                <span style={{ color: C.green, fontSize: 32, lineHeight: 0, verticalAlign: '-10px', marginRight: 4 }}>{'„'}</span>
                Als Bürgermeister weiß ich, was eine Gemeinde für gute Kommunikation braucht. Weil es das passende Werkzeug nicht gab, habe ich Dorfly selbst gebaut.
              </p>

              <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 24, marginBottom: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.blueL }}>Lukas Rosengrün</div>
                <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 3 }}>Bürgermeister der Gemeinde Ehningen und Gründer von Dorfly</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Eine Bürgerschaft, die wirklich informiert ist.',
                  'Eine Verwaltung, die weniger Arbeit hat.',
                  'Eine Demokratie, die im Alltag spürbar ist.',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#94A3B8' }}>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
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

// ── PREISE ────────────────────────────────────────────────────────────────────
const preisstaffel = [
  { bereich: 'bis 5.000 Einwohner',          preis: '299 Euro im Monat' },
  { bereich: 'bis 7.000 Einwohner',          preis: '399 Euro im Monat' },
  { bereich: 'bis 10.000 Einwohner',         preis: '499 Euro im Monat' },
  { bereich: '10.000 bis 15.000 Einwohner',  preis: '599 Euro im Monat' },
]

function Preise() {
  return (
    <section id="preis" style={{ background: C.bg, padding: 'clamp(64px, 10vw, 120px) 0' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <R><Eyebrow>Preis</Eyebrow></R>
        <R delay={0.1}>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, color: C.navy, marginBottom: 20 }}>
            Ein fester Monatspreis, gestaffelt nach Gemeindegröße.
          </h2>
        </R>
        <R delay={0.15}>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: C.muted, maxWidth: 640, marginBottom: 48 }}>
            Sie sehen hier, was Dorfly kostet. Ohne Anfrage, ohne Gespräch, ohne Angebot. Alle Funktionen der Gemeinde-App sind enthalten, keine Einrichtungsgebühr.
          </p>
        </R>
        <R delay={0.2}>
          <div style={{ background: C.white, borderRadius: 22, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <caption className="sr-only">Monatspreise gestaffelt nach Einwohnerzahl</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, padding: '18px 28px', borderBottom: `1.5px solid ${C.border}` }}>Gemeindegröße</th>
                  <th scope="col" style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, padding: '18px 28px', borderBottom: `1.5px solid ${C.border}` }}>Preis</th>
                </tr>
              </thead>
              <tbody>
                {preisstaffel.map(({ bereich, preis }, i) => (
                  <tr key={bereich} style={{ borderBottom: i < preisstaffel.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <th scope="row" style={{ textAlign: 'left', fontSize: 16, color: C.navy, padding: '18px 28px', fontWeight: 500 }}>{bereich}</th>
                    <td style={{ fontSize: 17, color: C.navy, padding: '18px 28px', fontWeight: 700, textAlign: 'right', letterSpacing: '-0.02em' }}>{preis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </R>
        <R delay={0.25}>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 20 }}>
            Alle Preise zzgl. gesetzlicher Umsatzsteuer.
          </p>
        </R>
      </div>
    </section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function CTA({ onDemo, onUpdates }: { onDemo: () => void; onUpdates: () => void }) {
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
                Neugierig?
              </div>
            </R>
            <R delay={0.1}>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 56px)', fontWeight: 800, letterSpacing: '-0.04em', color: C.white, lineHeight: 1.08, margin: '0 0 18px' }}>
                Lernen Sie Dorfly kennen.
              </h2>
            </R>
            <R delay={0.2}>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: '#94A3B8', maxWidth: 560, margin: '0 auto 44px' }}>
                Jede Bürgermeisterin und jeder Bürgermeister möchte nah an den Menschen sein. In die Gemeinde reinhören. Im echten Austausch mit der Bürgerschaft stehen. Dorfly macht daraus mehr als ein Versprechen. Schreiben Sie mir kurz, ich melde mich gerne persönlich bei Ihnen.
              </p>
            </R>
            <R delay={0.3}>
              <button
                onClick={onDemo}
                style={{
                  padding: '18px 44px', background: C.greenText, color: C.white,
                  border: 'none', borderRadius: 14, fontFamily: 'inherit',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0,168,120,.35)',
                  transition: 'background .2s, transform .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.greenTextHover; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = C.greenText; e.currentTarget.style.transform = 'none' }}
              >
                Demo anfragen
              </button>
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={onUpdates}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 14, color: '#94A3B8', textDecoration: 'underline',
                    textUnderlineOffset: 3, transition: 'color .2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.white)}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  Erstmal nur informiert bleiben
                </button>
              </div>
              <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 16 }}>
                Unverbindlich. Persönlich begleitet. Kein IT-Projekt.
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
            { label: 'Impressum',            href: '/impressum'            },
            { label: 'Datenschutz',          href: '/datenschutz'          },
            { label: 'Nutzungsbedingungen',  href: '/nutzungsbedingungen'  },
            { label: 'Kontakt',              href: 'mailto:hallo@dorfly.de' },
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
          <li>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="App Store – öffnet in neuem Tab"
              style={{ fontSize: 13, color: C.muted, textDecoration: 'none', transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.navy)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
            >
              App Store
            </a>
          </li>
        </ul>
        <span style={{ fontSize: 13, color: '#CBD5E1' }}>© 2026 Dorfly</span>
      </div>
    </footer>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function HomepagePage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  // useFocusTrap's own focus-restore branch only fires on an active:true→false
  // transition, but these modals are unmounted on close rather than hidden, so
  // that branch never runs. Track and restore the trigger element here instead.
  const demoTriggerRef = useRef<HTMLElement | null>(null)
  const updatesTriggerRef = useRef<HTMLElement | null>(null)

  function openDemo() {
    demoTriggerRef.current = document.activeElement as HTMLElement
    setDemoOpen(true)
  }
  function closeDemo() {
    setDemoOpen(false)
    demoTriggerRef.current?.focus()
  }
  function openUpdates() {
    updatesTriggerRef.current = document.activeElement as HTMLElement
    setUpdatesOpen(true)
  }
  function closeUpdates() {
    setUpdatesOpen(false)
    updatesTriggerRef.current?.focus()
  }

  return (
    <div className="mp" style={{ scrollBehavior: 'smooth' }}>
      <Nav onDemo={openDemo} />
      <main id="main-content" tabIndex={-1}>
        <Hero    onDemo={openDemo} />
        <Problem />
        <Zielgruppen />
        <Features />
        <DemoShowcase />
        <Setup />
        <About />
        <Preise />
        <CTA onDemo={openDemo} onUpdates={openUpdates} />
      </main>
      <Footer />
      {demoOpen    && <DemoModal    onClose={closeDemo}    />}
      {updatesOpen && <UpdatesModal onClose={closeUpdates} />}
    </div>
  )
}
