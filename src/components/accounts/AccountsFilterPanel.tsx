import { useUIStore } from '@/store/uiStore'

const ACCOUNT_TYPES = [
  { value: 'card',       label: 'Cards' },
  { value: 'cash',       label: 'Cash' },
  { value: 'savings',    label: 'Savings' },
  { value: 'investment', label: 'Investments' },
]

const CURRENCIES = ['EUR', 'USD', 'RUB']

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-primary/15 text-primary border-primary' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

interface Props { open: boolean; onClose: () => void }

export function AccountsFilterPanel({ open, onClose }: Props) {
  const { accountsFilter, setAccountsFilter } = useUIStore()

  const toggle = (key: 'types' | 'currencies', value: string) => {
    const current = accountsFilter[key]
    setAccountsFilter({
      ...accountsFilter,
      [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
    })
  }

  const hasFilter = accountsFilter.types.length > 0 || accountsFilter.currencies.length > 0

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl border-t transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '55dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-6 flex flex-col gap-5">
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_TYPES.map(t => (
                <Chip key={t.value} active={accountsFilter.types.includes(t.value)} onClick={() => toggle('types', t.value)}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </section>
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Currency</p>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map(c => (
                <Chip key={c} active={accountsFilter.currencies.includes(c)} onClick={() => toggle('currencies', c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </section>
          {hasFilter && (
            <button
              onClick={() => { setAccountsFilter({ types: [], currencies: [] }); onClose() }}
              className="self-start text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </>
  )
}
