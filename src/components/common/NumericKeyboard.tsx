import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  onChange: (v: string) => void
  onClose: () => void
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
]

export function NumericKeyboard({ value, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // capture phase so we catch events before they reach other handlers
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [onClose])

  const press = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.') {
      if (!value.includes('.')) onChange((value || '0') + '.')
      return
    }
    if (value === '0') { onChange(key); return }
    const dotIdx = value.indexOf('.')
    if (dotIdx !== -1 && value.length - dotIdx > 2) return
    onChange(value + key)
  }

  return createPortal(
    <div
      ref={panelRef}
      className="fixed inset-x-0 bottom-0 z-[9999] border-t border-border bg-background shadow-lg"
      onPointerDown={e => e.stopPropagation()}
    >
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex">
          {row.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              style={{ touchAction: 'manipulation' }}
              className="flex-1 py-4 text-xl font-medium border-r border-b border-border/40 last:border-r-0 active:bg-accent transition-colors select-none"
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  )
}
