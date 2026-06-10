import { useRef } from 'react'

function isoToDot(iso: string): string {
  if (!iso || iso.length < 10) return ''
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

/**
 * Date picker with DD.MM.YYYY overlay.
 * Clicking anywhere opens the native calendar (showPicker API).
 * On mobile the tap also opens the native picker.
 */
export function DatePicker({ value, onChange, placeholder = 'DD.MM.YYYY', className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const open = () => {
    try { inputRef.current?.showPicker() } catch { inputRef.current?.focus() }
  }

  return (
    <div
      className={`relative flex-1 cursor-pointer ${className}`}
      onClick={open}
    >
      {/* Visible display */}
      <div className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background pointer-events-none min-h-[38px] flex items-center select-none">
        {value
          ? <span>{isoToDot(value)}</span>
          : <span className="text-muted-foreground">{placeholder}</span>
        }
        {/* Calendar icon always visible */}
        <svg className="ml-auto w-4 h-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      </div>
      {/* Hidden native input — covers the full area */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => { if (e.target.value) onChange(e.target.value) }}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        tabIndex={-1}
      />
    </div>
  )
}
