import { Check } from 'lucide-react'

const SWATCHES = [
  '#ef4444', '#dc2626',
  '#f97316', '#ea580c',
  '#eab308', '#ca8a04',
  '#22c55e', '#16a34a',
  '#10b981', '#059669',
  '#14b8a6', '#0d9488',
  '#06b6d4', '#0891b2',
  '#3b82f6', '#2563eb',
  '#8b5cf6', '#7c3aed',
  '#ec4899', '#db2777',
  '#6b7280', '#374151',
]

interface Props {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-11 gap-1.5">
      {SWATCHES.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-7 h-7 rounded-full relative flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {value === color && <Check size={14} color="#fff" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}
