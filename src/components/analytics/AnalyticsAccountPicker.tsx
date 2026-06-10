import { useAccountsStore } from '@/store/accountsStore'
import { usePrefsStore } from '@/store/prefsStore'
import { DEFAULT_ENTITY_COLOR, ON_COLOR_TEXT, ICON_SIZES } from '@/utils/design'
import { CreditCard, Wallet, PiggyBank, TrendingUp } from 'lucide-react'
import type { AccountType } from '@/types/account'

const TYPE_ICON: Record<AccountType, React.FC<{ size?: number }>> = {
  card: CreditCard, cash: Wallet, savings: PiggyBank, investment: TrendingUp,
}

interface Props { open: boolean; onClose: () => void }

export function AnalyticsAccountPicker({ open, onClose }: Props) {
  const { accounts } = useAccountsStore()
  const { analyticsAccountIds, setAnalyticsAccountIds } = usePrefsStore()

  const active = accounts.filter(a => !a.archived)
  const allSelected = analyticsAccountIds.length === 0

  const toggle = (id: string) => {
    if (allSelected) {
      // switching from "all" → exclude this one account
      void setAnalyticsAccountIds(active.filter(a => a.id !== id).map(a => a.id))
    } else if (analyticsAccountIds.includes(id)) {
      const next = analyticsAccountIds.filter(x => x !== id)
      // if nothing left, go back to "all"
      void setAnalyticsAccountIds(next.length === 0 ? [] : next)
    } else {
      const next = [...analyticsAccountIds, id]
      // if all are now selected, collapse back to "all"
      void setAnalyticsAccountIds(next.length === active.length ? [] : next)
    }
  }

  const isSelected = (id: string) => allSelected || analyticsAccountIds.includes(id)

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl border-t transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '65dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        <div className="px-4 pb-2 shrink-0">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Balance trend: accounts
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select which accounts are included in the balance line
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {/* All accounts shortcut */}
          <button
            onClick={() => void setAnalyticsAccountIds([])}
            className={`w-full flex items-center gap-3 py-3 border-b text-sm ${allSelected ? 'text-primary font-medium' : 'text-muted-foreground'}`}
          >
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${allSelected ? 'border-primary bg-primary' : 'border-border'}`}>
              {allSelected && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            All accounts
          </button>

          {active.map(a => {
            const Icon = TYPE_ICON[a.type]
            const selected = isSelected(a.id)
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className="w-full flex items-center gap-3 py-3 border-b last:border-0 text-left"
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${selected ? 'border-primary bg-primary' : 'border-border'}`}>
                  {selected && (
                    <svg viewBox="0 0 10 8" className="w-3 h-2.5 fill-white">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: a.color || DEFAULT_ENTITY_COLOR, color: ON_COLOR_TEXT }}
                >
                  <Icon size={ICON_SIZES.sm} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.type} · {a.currency}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
