import { ReactNode, RefObject } from 'react'

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

interface BoldButtonProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
}

export function BoldButton({ textareaRef, value, onChange }: BoldButtonProps) {
  function apply() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)
    onChange(value.slice(0, start) + '**' + selected + '**' + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(
        start === end ? start + 2 : start,
        start === end ? start + 2 : end + 4,
      )
    })
  }
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); apply() }}
      className="px-2 py-0.5 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 transition-colors"
      title="Fett"
    >
      B
    </button>
  )
}
