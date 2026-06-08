import * as icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: string
  color: string
  size?: number
}

export function CategoryIcon({ icon, color, size = 16 }: Props) {
  const IconComponent = ((icons as unknown) as Record<string, LucideIcon>)[icon] ?? icons.Tag
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color, width: size + 12, height: size + 12 }}
    >
      <IconComponent size={size} color="#fff" />
    </div>
  )
}
