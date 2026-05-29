import { ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// ── Typen ────────────────────────────────────────────────────────────────────

export type Segment =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'url'; url: string }
  | { type: 'br' }

// ── Parsing ───────────────────────────────────────────────────────────────────

export function isValidLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function appendTextWithBreaks(text: string, segments: Segment[]): void {
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line) segments.push({ type: 'text', content: line })
    if (i < lines.length - 1) segments.push({ type: 'br' })
  })
}

export function parseRichText(raw: string): Segment[] {
  if (!raw) return []
  const re = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<>"]+)|(\*\*[^*]+\*\*)/g
  const decoded = raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  const segments: Segment[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(decoded)) !== null) {
    if (match.index > lastIdx) {
      appendTextWithBreaks(decoded.slice(lastIdx, match.index), segments)
    }
    const full = match[0]
    if (full.startsWith('[')) {
      const m = full.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
      if (m) {
        segments.push({ type: 'link', text: m[1], url: m[2] })
      }
      // The else branch is dead code: the outer regex already requires https?:// in the URL
    } else if (full.startsWith('http')) {
      segments.push({ type: 'url', url: full })
    } else if (full.startsWith('**')) {
      segments.push({ type: 'bold', content: full.slice(2, -2) })
    }
    lastIdx = match.index + full.length
  }
  if (lastIdx < decoded.length) {
    appendTextWithBreaks(decoded.slice(lastIdx), segments)
  }
  return segments
}

// ── Display ───────────────────────────────────────────────────────────────────

export function renderRichText(text: string): ReactNode {
  if (!text) return null
  const segments = parseRichText(text)
  if (segments.length === 0) return null
  if (segments.length === 1 && segments[0].type === 'text') return segments[0].content
  return segments.map((seg, i) => {
    switch (seg.type) {
      case 'text': return <span key={i}>{seg.content}</span>
      case 'br':   return <br key={i} />
      case 'bold': return <strong key={i}>{seg.content}</strong>
      case 'link':
        return (
          <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer"
             className="text-primary-600 underline underline-offset-2 break-all">
            {seg.text}
          </a>
        )
      case 'url':
        return (
          <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer"
             className="text-primary-600 underline underline-offset-2 break-all">
            {seg.url}
          </a>
        )
      default: {
        const _exhaustive: never = seg
        return null
      }
    }
  })
}

// ── Conversion: **markdown** ↔ editor HTML ────────────────────────────────────

function escapeHtml(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function mdToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

export function htmlToMd(html: string): string {
  if (!html || html === '<br>') return ''
  return html
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<span[^>]*font-weight:\s*bold[^>]*>([\s\S]*?)<\/span>/gi, '**$1**')
    .replace(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, inner) => {
      const txt = inner.replace(/<[^>]+>/g, '').trim()
      return txt && txt !== url ? `[${txt}](${url})` : url
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n+$/, '')
}

// ── LinkPopup ────────────────────────────────────────────────────────────────

interface LinkPopupProps {
  selectedText: string
  onInsert: (displayText: string, url: string) => void
  onClose: () => void
}

function LinkPopup({ selectedText, onInsert, onClose }: LinkPopupProps) {
  const containerRef = useFocusTrap(true)
  const [displayText, setDisplayText] = useState(selectedText)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const uid = useId()

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const triggerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null
  )
  useEffect(() => {
    return () => { triggerRef.current?.focus() }
  }, [])

  function handleSubmit() {
    if (!isValidLinkUrl(url)) {
      setUrlError('Bitte eine gültige URL eingeben (https://...)')
      return
    }
    onInsert(displayText.trim() || url, url.trim())
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Link einfügen"
      className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72 space-y-2"
    >
      {!selectedText && (
        <div>
          <label htmlFor={`${uid}-display`} className="block text-xs text-gray-600 mb-1">Anzeigetext</label>
          <input
            id={`${uid}-display`}
            value={displayText}
            onChange={e => setDisplayText(e.target.value)}
            placeholder="Anzeigetext"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      )}
      <div>
        <label htmlFor={`${uid}-url`} className="block text-xs text-gray-600 mb-1">URL</label>
        <input
          id={`${uid}-url`}
          value={url}
          onChange={e => { setUrl(e.target.value); setUrlError('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
          placeholder="https://..."
          type="url"
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <p aria-live="assertive" className="text-red-500 text-xs mt-1 min-h-[1rem]">{urlError}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 text-xs py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          Einfügen
        </button>
      </div>
    </div>
  )
}

// ── RichTextEditor ────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  compact?: boolean
}

export function RichTextEditor({ value, onChange, placeholder, rows = 4, compact = false }: RichTextEditorProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const lastSent = useRef('')
  const [empty, setEmpty] = useState(!value)
  const [showLinkPopup, setShowLinkPopup] = useState(false)
  const savedRange = useRef<Range | null>(null)
  const savedSelection = useRef('')

  useEffect(() => {
    if (divRef.current) {
      divRef.current.innerHTML = mdToHtml(value)
      lastSent.current = value
      setEmpty(!value)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (divRef.current && value !== lastSent.current) {
      divRef.current.innerHTML = mdToHtml(value)
      lastSent.current = value
      setEmpty(!value)
    }
  }, [value])

  function sync() {
    if (!divRef.current) return
    const md = htmlToMd(divRef.current.innerHTML)
    lastSent.current = md
    onChange(md)
    setEmpty(!md)
  }

  function applyBold() {
    divRef.current?.focus()
    document.execCommand('bold')
    sync()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
    sync()
  }

  function openLinkPopup() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && divRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
      savedSelection.current = sel.toString()
    } else {
      savedRange.current = null
      savedSelection.current = ''
    }
    setShowLinkPopup(true)
  }

  function insertLink(displayText: string, url: string) {
    if (!divRef.current) return
    divRef.current.focus()
    if (savedRange.current) {
      const sel = window.getSelection()
      if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current) }
    }
    document.execCommand('insertText', false, `[${displayText}](${url})`)
    sync()
    savedRange.current = null
    savedSelection.current = ''
    setShowLinkPopup(false)
  }

  function closeLinkPopup() {
    setShowLinkPopup(false)
    savedRange.current = null
    savedSelection.current = ''
    divRef.current?.focus()
  }

  const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3'
  const textCls = compact ? 'text-sm' : ''
  const borderCls = compact ? 'border-gray-200' : 'border-gray-300'
  const minH = `${rows * (compact ? 1.5 : 1.6)}rem`

  return (
    <div>
      <div className="flex gap-1 mb-1 relative">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); applyBold() }}
          className="px-2 py-0.5 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          title="Fett"
          aria-label="Fett"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); openLinkPopup() }}
          className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center"
          aria-label="Link einfügen"
          title="Link einfügen"
        >
          <Link2 className="w-3 h-3" aria-hidden="true" />
        </button>
        {showLinkPopup && (
          <LinkPopup
            selectedText={savedSelection.current}
            onInsert={insertLink}
            onClose={closeLinkPopup}
          />
        )}
      </div>
      <div
        className={`w-full rounded-xl border ${borderCls} focus-within:ring-2 focus-within:ring-primary-500 relative cursor-text overflow-hidden`}
        onClick={() => divRef.current?.focus()}
      >
        {empty && placeholder && (
          <p className={`absolute inset-0 ${pad} ${textCls} text-gray-400 pointer-events-none select-none`}>
            {placeholder}
          </p>
        )}
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onPaste={handlePaste}
          className={`outline-none ${pad} ${textCls} leading-relaxed`}
          style={{ minHeight: minH }}
        />
      </div>
    </div>
  )
}
