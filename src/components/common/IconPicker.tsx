import { useState } from 'react'
import * as icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_NAMES = [
  'ShoppingCart', 'UtensilsCrossed', 'Car', 'Bus', 'Heart', 'Pill',
  'Shirt', 'Home', 'Zap', 'Wifi', 'Gamepad2', 'Plane',
  'GraduationCap', 'Gift', 'Dumbbell', 'Coffee', 'Baby', 'PawPrint',
  'Wrench', 'Banknote', 'TrendingUp', 'BookOpen', 'Music', 'Camera',
  'Scissors', 'Sparkles', 'Tag', 'ShoppingBag', 'Fuel', 'Train',
  'Pizza', 'Salad', 'Wine', 'Beer', 'IceCream', 'Cake',
]

interface Props {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState('')
  const filtered = ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-2">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search icons..."
        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
      />
      <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
        {filtered.map(name => {
          const Icon = ((icons as unknown) as Record<string, LucideIcon>)[name]
          if (!Icon) return null
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              title={name}
              className={`w-10 h-10 flex items-center justify-center rounded-md border transition-colors ${value === name ? 'border-primary bg-accent ring-2 ring-primary' : 'border-border hover:bg-accent'}`}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
