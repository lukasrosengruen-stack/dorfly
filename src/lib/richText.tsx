import { ReactNode, useEffect, useRef, useState } from 'react'

// ── Display: **bold** → <strong> (for FeedCard) ──────────────────────────────

export function renderRichText(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
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

function htmlToMd(html: string): string {
  if (!html || html === '<br>') return ''
  return html
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<span[^>]*font-weight:\s*bold[^>]*>([\s\S]*?)<\/span>/gi, '**$1**')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n+$/, '')
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

  const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3'
  const textCls = compact ? 'text-sm' : ''
  const borderCls = compact ? 'border-gray-200' : 'border-gray-300'
  const minH = `${rows * (compact ? 1.5 : 1.6)}rem`

  return (
    <div>
      <div className="flex gap-1 mb-1">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); applyBold() }}
          className="px-2 py-0.5 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          title="Fett"
        >
          B
        </button>
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
