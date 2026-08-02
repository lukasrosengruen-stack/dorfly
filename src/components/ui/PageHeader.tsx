/**
 * PageHeader – Blauer Seitenkopf mit Gemeindename, Titel, Untertitel und Profil-Link
 *
 * Ersetzt das Copy-Paste-Muster aus Feed, Umfragen, Marktplatz, etc.
 *
 * @example
 * <PageHeader
 *   gemeindeName="Ehningen"
 *   title="Neuigkeiten"
 *   subtitle="Aktuelles aus der Gemeinde"
 *   actions={<FilterButton />}
 * />
 */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  /** Gemeindename – wird in Gold über dem Titel angezeigt */
  gemeindeName?: string
  /** Haupt-Überschrift */
  title: string
  /** Optionaler Untertitel */
  subtitle?: string
  /** Zusätzliche Elemente rechts neben dem Profil-Link (z. B. Filter-Button) */
  actions?: React.ReactNode
  /** Zeigt einen "Zurück"-Button über dem Titel (nutzt router.back()) */
  showBack?: boolean
  /** Sticky (fixiert beim Scrollen) – Standard: true */
  sticky?: boolean
  className?: string
}

export function PageHeader({
  gemeindeName,
  title,
  subtitle,
  actions,
  showBack = false,
  sticky = true,
  className,
}: PageHeaderProps) {
  const router = useRouter()

  return (
    <div
      className={cn(
        'bg-primary-500 px-4 pt-safe-header pb-4',
        sticky && 'sticky top-0 z-10',
        className,
      )}
    >
      {showBack && (
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-white/70 text-xs font-bold mb-3"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Zurück
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        {/* Linke Seite: Gemeindename + Titel */}
        <div className="flex-1 min-w-0">
          {gemeindeName && (
            <p className="text-gold-500 text-[10px] font-bold tracking-[3px] uppercase mb-0.5">
              {gemeindeName}
            </p>
          )}
          <h1 className="text-white font-extrabold text-[22px] leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-white/60 text-xs mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Rechte Seite: optionale Actions + Profil-Icon */}
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {actions}
          <Link
            href="/profil"
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            aria-label="Zum Profil"
          >
            <User className="w-4 h-4 text-white" />
          </Link>
        </div>
      </div>
    </div>
  )
}
