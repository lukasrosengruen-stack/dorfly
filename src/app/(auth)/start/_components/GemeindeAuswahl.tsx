'use client'

import { useState, useId } from 'react'
import { Search, LogIn, UserPlus } from 'lucide-react'

interface Gemeinde {
  id: string
  name: string
  slug: string
}

interface Props {
  gemeinden: Gemeinde[]
  rootDomain: string
}

export default function GemeindeAuswahl({ gemeinden, rootDomain }: Props) {
  const [suche, setSuche] = useState('')
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null)
  const suchId = useId()
  const listId = useId()

  const gefiltert = gemeinden.filter(g =>
    g.name.toLowerCase().includes(suche.toLowerCase())
  )

  const ausgewaehlteName = gemeinden.find(g => g.slug === ausgewaehlt)?.name

  function navigate(slug: string, pfad: string) {
    window.location.href = `https://${slug}.${rootDomain}${pfad}`
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-3xl font-extrabold tracking-tight leading-none">
          <span style={{ color: '#0057A8' }}>Dorf</span>
          <span style={{ color: '#0D1B2A' }}>ly</span>
          <span style={{ color: '#00A878' }}>.</span>
        </div>
        <p className="text-gray-500 text-sm mt-3 leading-relaxed">
          Wählen Sie Ihre Gemeinde, um fortzufahren.
        </p>
      </div>

      {/* Suchfeld */}
      <div className="mb-2">
        <label htmlFor={suchId} className="sr-only">
          Gemeinde suchen
        </label>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            aria-hidden="true"
          />
          <input
            id={suchId}
            type="search"
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Gemeinde suchen ..."
            autoComplete="off"
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
        </div>
      </div>

      {/* Gemeinde-Liste */}
      <ul
        id={listId}
        aria-label="Gemeinde auswählen"
        className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50 mb-6"
      >
        {gefiltert.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-400">
            Keine Gemeinde gefunden.
          </li>
        ) : (
          gefiltert.map(g => {
            const istAusgewaehlt = ausgewaehlt === g.slug
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={istAusgewaehlt}
                  onClick={() => setAusgewaehlt(g.slug)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    istAusgewaehlt
                      ? 'bg-primary-500 text-white font-semibold'
                      : 'text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {g.name}
                </button>
              </li>
            )
          })
        )}
      </ul>

      {/* Status-Hinweis */}
      <p className="text-center text-xs text-gray-400 mb-4 min-h-[1rem]">
        {ausgewaehlteName
          ? <>Gemeinde gewählt: <strong className="text-gray-600">{ausgewaehlteName}</strong></>
          : 'Bitte wählen Sie zuerst Ihre Gemeinde aus.'}
      </p>

      {/* CTAs */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={!ausgewaehlt}
          onClick={() => ausgewaehlt && navigate(ausgewaehlt, '/login')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          Ich habe schon ein Konto — anmelden
        </button>

        <button
          type="button"
          disabled={!ausgewaehlt}
          onClick={() => ausgewaehlt && navigate(ausgewaehlt, '')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border border-primary-500 text-primary-500 transition-colors hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          Neu registrieren
        </button>
      </div>

      {/*
        OFFENER RANDFALL (für späteren Middleware-/Login-Schritt):
        Nutzer mit Konto in Gemeinde X wählt hier Gemeinde Y und klickt "Anmelden".
        Er landet auf y.dorfly.de/login, obwohl seine gemeinde_id X ist.
        Nach erfolgreichem Login leitet login/page.tsx ihn anhand seines Profils
        zur richtigen Subdomain weiter — der Widerspruch löst sich also dort auf.
        Trotzdem prüfen ob ein expliziter Hinweis oder eine Absicherung nötig ist.
      */}
    </div>
  )
}
