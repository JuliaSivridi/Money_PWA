interface Props {
  value: string
  onChange: (v: string) => void
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
]

export function NumericKeyboard({ value, onChange }: Props) {
  const press = (key: string) => {
    if (key === '⌫') { onChange(value.slice(0, -1)); return }
    if (key === '.') {
      if (!value.includes('.')) onChange((value || '0') + '.')
      return
    }
    if (value === '0') { onChange(key); return }
    const dotIdx = value.indexOf('.')
    if (dotIdx !== -1 && value.length - dotIdx > 2) return
    onChange(value + key)
  }

  return (
    <div className="mt-1 border border-border rounded-md overflow-hidden">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex border-b border-border/40 last:border-b-0">
          {row.map(key => (
            <button
              key={key}
              type="button"
              onPointerDown={e => { e.preventDefault(); press(key) }}
              style={{ touchAction: 'manipulation' }}
              className="flex-1 py-3 text-lg font-medium border-r border-border/40 last:border-r-0 bg-background active:bg-accent transition-colors select-none"
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
