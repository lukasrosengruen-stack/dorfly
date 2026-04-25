'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2, Mail, Link2, MessageCircle, Check } from 'lucide-react'

interface Props {
  postId: string
  titel: string
  inhalt: string
  gemeindeName?: string
}

export default function ShareButton({ postId, titel, inhalt, gemeindeName = 'Ehningen' }: Props) {
  const [showFallback, setShowFallback] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://dorfly.vercel.app'}/posts/${postId}`
  const text = `${titel}\n\n${inhalt.slice(0, 200)}${inhalt.length > 200 ? '...' : ''}`

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowFallback(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: titel, text: inhalt.slice(0, 200), url })
      } catch {}
      return
    }
    setShowFallback(v => !v)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => { setCopied(false); setShowFallback(false) }, 1500)
  }

  function shareEmail() {
    const subject = encodeURIComponent(`${titel} – Dorfly ${gemeindeName}`)
    const body = encodeURIComponent(`${text}\n\nMehr lesen: ${url}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
    setShowFallback(false)
  }

  function shareWhatsApp() {
    window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(`${text}\n\n${url}`)}`)
    setShowFallback(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={share}
        className="flex items-center gap-1.5 text-xs text-gray-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Teilen
      </button>

      {showFallback && (
        <div className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 w-52 z-50">
          <button onClick={copyLink}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
            {copied ? <Check className="w-4 h-4 text-primary-500" /> : <Link2 className="w-4 h-4 text-gray-500" />}
            <span className="text-sm font-medium text-gray-700">{copied ? 'Kopiert!' : 'Link kopieren'}</span>
          </button>
          <button onClick={shareWhatsApp}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
            <MessageCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-gray-700">WhatsApp</span>
          </button>
          <button onClick={shareEmail}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Per E-Mail</span>
          </button>
        </div>
      )}
    </div>
  )
}
