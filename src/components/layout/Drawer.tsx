import { Wallet, CreditCard, Tag, BarChart2 } from 'lucide-react'
import { useUIStore, type SelectedView } from '@/store/uiStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { view: SelectedView; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { view: 'transactions', label: 'Transactions', Icon: Wallet },
  { view: 'accounts',     label: 'Accounts',     Icon: CreditCard },
  { view: 'categories',   label: 'Categories',   Icon: Tag },
  { view: 'analytics',    label: 'Analytics',    Icon: BarChart2 },
]

export function Drawer() {
  const { selectedView, setView } = useUIStore()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ view, label, Icon }) => (
        <button
          key={view}
          onClick={() => setView(view)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left w-full',
            selectedView === view
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
    </nav>
  )
}
