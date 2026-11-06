/**
 * Bausteine für die Ladeansichten (`loading.tsx`) der App.
 *
 * Fest stehende Texte wie Seitentitel erscheinen schon echt, damit die Seite beim
 * Laden nicht springt; nur was vom Server kommt, ist ein pulsierender Platzhalter.
 */
import { cn } from '@/lib/cn'

const KARTE = 'bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)]'

/** Rahmen jeder Ladeansicht: Screenreader hören nur den Ladehinweis. */
export function Skelett({ children }: { children: React.ReactNode }) {
  return (
    <div role="status">
      <span className="sr-only">Seite wird geladen</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

export function Balken({ className }: { className?: string }) {
  return <div className={cn('motion-safe:animate-pulse rounded bg-gray-200', className)} />
}

interface KopfProps {
  titel?: string
  untertitel?: string
  zurueck?: boolean
  /** Platzhalter für eine Schaltfläche links neben dem Profil-Symbol, z. B. „Filtern“ */
  aktion?: boolean
  className?: string
  children?: React.ReactNode
}

/** Blauer Seitenkopf wie `PageHeader`. */
export function KopfBlau({ titel, untertitel, zurueck, aktion, className, children }: KopfProps) {
  return (
    <div className={cn('bg-primary-500 px-4 pt-safe-header pb-4', className)}>
      {zurueck && <Balken className="h-4 w-16 mb-2 -mt-1 bg-white/20" />}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Balken className="h-2.5 w-20 mb-1.5 bg-white/20" />
          {titel
            ? <p className="text-white font-extrabold text-[22px] leading-tight">{titel}</p>
            : <Balken className="h-6 w-44 bg-white/30" />}
          {untertitel && <p className="text-white/60 text-xs mt-0.5">{untertitel}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {aktion && <Balken className="h-7 w-20 rounded-xl bg-white/20" />}
          <div className="w-8 h-8 rounded-full bg-white/20" />
        </div>
      </div>
      {children}
    </div>
  )
}

/**
 * Weißer Seitenkopf wie bei Mängelmelder, Bürgermeister und Profil.
 * `oben` statt `className`: tailwind-merge kennt pt-safe-header nicht und würde es nicht ersetzen.
 */
export function KopfHell({ titel, untertitel, zurueck, oben = 'pt-safe-header', children }: KopfProps & { oben?: string }) {
  return (
    <div className={cn('bg-white border-b border-gray-100 px-4 pb-4', oben)}>
      <div className="flex items-center gap-2">
        {zurueck && <Balken className="h-6 w-6 rounded-lg" />}
        <div className="flex-1 min-w-0">
          {titel
            ? <p className="text-xl font-bold text-gray-900">{titel}</p>
            : <Balken className="h-6 w-48" />}
          {untertitel && <p className="text-sm text-gray-500">{untertitel}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Zeitraum-Leiste unter dem Kopf von Veranstaltungen und Abfallkalender. */
export function ZeitraumLeiste() {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex gap-2">
      {[0, 1, 2].map(i => <Balken key={i} className="h-9 w-20 rounded-full shrink-0" />)}
    </div>
  )
}

/** Beitrag im Feed: farbiges Band, Schlagwort, Titel, Anreißer. */
export function BeitragKarte({ band = true }: { band?: boolean }) {
  return (
    <div className={cn(KARTE, 'overflow-hidden')}>
      {band && <Balken className="h-8 rounded-none" />}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Balken className="h-4 w-20 rounded-full" />
          <Balken className="h-3 w-14" />
        </div>
        <Balken className="h-4 w-3/4" />
        <Balken className="h-3 w-full mt-3" />
        <Balken className="h-3 w-5/6 mt-2" />
      </div>
    </div>
  )
}

/** Verein oder Betrieb in der Liste: Logo, Name, Beschreibung, Abo-Glocke. */
export function VerzeichnisKarte() {
  return (
    <div className={cn(KARTE, 'p-4 flex items-center gap-4')}>
      <Balken className="w-14 h-14 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <Balken className="h-3.5 w-2/3" />
        <Balken className="h-2.5 w-1/3 mt-2" />
        <Balken className="h-2.5 w-full mt-2" />
      </div>
      <Balken className="w-9 h-9 rounded-xl shrink-0" />
    </div>
  )
}

/** Meldung oder Frage: Titel mit Status-Kennzeichen und Text. */
export function MeldungKarte() {
  return (
    <div className={cn(KARTE, 'p-4')}>
      <div className="flex items-start justify-between gap-2">
        <Balken className="h-4 w-1/2" />
        <Balken className="h-6 w-20 rounded-full shrink-0" />
      </div>
      <Balken className="h-3 w-full mt-3" />
      <Balken className="h-3 w-2/3 mt-2" />
      <Balken className="h-2.5 w-16 mt-3" />
    </div>
  )
}

/** Kasten mit Überschrift und Zeilen wie im Profil und den Einstellungen. */
export function ZeilenKarte({ zeilen = 3, ueberschrift }: { zeilen?: number; ueberschrift?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {ueberschrift && (
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{ueberschrift}</p>
        </div>
      )}
      {Array.from({ length: zeilen }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-b-0">
          <Balken className="w-5 h-5 rounded-md shrink-0" />
          <Balken className="h-3 flex-1" />
        </div>
      ))}
    </div>
  )
}

/** Termine nach Tagen gruppiert, wie bei Veranstaltungen und Abfallkalender. */
export function TageGruppe() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Balken className="w-12 h-14 rounded-2xl shrink-0" />
        <div className="flex-1">
          <Balken className="h-3.5 w-24" />
          <Balken className="h-2.5 w-32 mt-2" />
        </div>
      </div>
      <div className="ml-1">
        <div className={cn(KARTE, 'p-4 flex items-center gap-3')}>
          <Balken className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1">
            <Balken className="h-3.5 w-2/3" />
            <Balken className="h-2.5 w-1/2 mt-2" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Listenseite für Vereine und Betriebe: Suchfeld und Karten. */
export function VerzeichnisSkelett({ titel }: { titel: string }) {
  return (
    <Skelett>
      <KopfBlau titel={titel} zurueck aktion />
      <div className="p-4 space-y-4">
        <div className="h-10 rounded-xl border border-gray-200 bg-white" />
        <div className="flex gap-2">
          {[0, 1, 2].map(i => <Balken key={i} className="h-7 w-20 rounded-full" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map(i => <VerzeichnisKarte key={i} />)}
        </div>
      </div>
    </Skelett>
  )
}

/** Terminseite für Veranstaltungen und Abfallkalender. */
export function TermineSkelett({ titel, einstellungen }: { titel: string; einstellungen?: boolean }) {
  return (
    <Skelett>
      <div className="bg-primary-500 px-4 pt-safe-header pb-5">
        <div className="flex items-center justify-between mb-1">
          <Balken className="h-3 w-24 bg-white/20" />
          <div className="flex items-center gap-2">
            {einstellungen && <div className="w-8 h-8 rounded-full bg-white/20" />}
            <div className="w-8 h-8 rounded-full bg-white/20" />
          </div>
        </div>
        <p className="text-white font-black text-2xl">{titel}</p>
      </div>
      <ZeitraumLeiste />
      <div className="px-4 py-5 space-y-6">
        {[0, 1, 2].map(i => <TageGruppe key={i} />)}
      </div>
    </Skelett>
  )
}
