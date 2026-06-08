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
  const press = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.') {
      if (!value.includes('.')) onChange((value || '0') + '.')
      return
    }
    // Replace leading zero
    if (value === '0') { onChange(key); return }
    // Limit to 2 decimal places
    const dotIdx = value.indexOf('.')
    if (dotIdx !== -1 && value.length - dotIdx > 2) return
    onChange(value + key)
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[199]" onPointerDown={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[200] border-t border-border bg-muted/95 backdrop-blur-sm pb-safe">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex">
            {row.map(key => (
              <button
                key={key}
                type="button"
                onPointerDown={e => { e.preventDefault(); press(key) }}
                className="flex-1 py-4 text-xl font-medium border-r border-b border-border/40 last:border-r-0 bg-background active:bg-accent transition-colors select-none"
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>,
    document.body,
  )
}
