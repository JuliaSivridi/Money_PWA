import { CategoryIcon } from './CategoryIcon'
import { useUIStore } from '@/store/uiStore'
import { useAccountsStore } from '@/store/accountsStore'
import { useCategoriesStore } from '@/store/categoriesStore'

/** Format local Date as YYYY-MM-DD without timezone shift */
function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Always returns first and last day of a month (0 = current, -1 = previous) */
function getMonthRange(offset: 0 | -1): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offset   // JS handles month=-1 correctly (Dec of prev year)
  return {
    from: localISO(new Date(year, month, 1)),
    to:   localISO(new Date(year, month + 1, 0)),  // day 0 = last day of `month`
  }
}

/** Display YYYY-MM-DD as DD.MM.YYYY; empty → placeholder */
function isoToDot(iso: string): string {
  if (!iso || iso.length < 10) return ''
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

/** Date picker: DD.MM.YYYY display over a hidden native date input */
function DatePicker({ value, onChange, placeholder = 'DD.MM.YYYY' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative flex-1">
      <div className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background pointer-events-none min-h-[38px] flex items-center">
        {value
          ? <span>{isoToDot(value)}</span>
          : <span className="text-muted-foreground">{placeholder}</span>
        }
      </div>
      <input
        type="date"
        value={value}
        onChange={e => { if (e.target.value) onChange(e.target.value) }}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      />
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

// "Debt" is a virtual type that maps to both debt_lent + debt_borrowed
const TYPE_OPTIONS = [
  { value: 'expense',  label: 'Expense' },
  { value: 'income',   label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'debt',     label: 'Debt' },
] as const
type VirtualType = typeof TYPE_OPTIONS[number]['value']

function isDebtActive(types: string[]) {
  return types.includes('debt_lent') || types.includes('debt_borrowed')
}
function toggleDebt(types: string[]): string[] {
  const active = isDebtActive(types)
  const without = types.filter(t => t !== 'debt_lent' && t !== 'debt_borrowed')
  return active ? without : [...without, 'debt_lent', 'debt_borrowed']
}

function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-primary/15 text-primary border-primary'
          : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

export function FilterPanel({ open, onClose }: Props) {
  const { filterState, setFilter, clearFilters } = useUIStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()

  const toggleType = (v: VirtualType) => {
    if (v === 'debt') {
      setFilter({ types: toggleDebt(filterState.types) })
    } else {
      const types = filterState.types.includes(v)
        ? filterState.types.filter(t => t !== v)
        : [...filterState.types, v]
      setFilter({ types })
    }
  }

  const toggleAccount = (id: string) =>
    setFilter({ accountIds: filterState.accountIds.includes(id)
      ? filterState.accountIds.filter(x => x !== id)
      : [...filterState.accountIds, id] })

  const toggleCategory = (id: string) =>
    setFilter({ categoryIds: filterState.categoryIds.includes(id)
      ? filterState.categoryIds.filter(x => x !== id)
      : [...filterState.categoryIds, id] })

  const activeAccounts = accounts.filter(a => !a.archived)

  const hasFilters = filterState.accountIds.length > 0 || filterState.types.length > 0 ||
    filterState.categoryIds.length > 0 || filterState.dateFrom || filterState.dateTo ||
    filterState.amountMin !== '' || filterState.amountMax !== ''

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl border-t transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '80dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 flex flex-col gap-5">

          {/* Type */}
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(opt => (
                <Chip
                  key={opt.value}
                  active={opt.value === 'debt' ? isDebtActive(filterState.types) : filterState.types.includes(opt.value)}
                  onClick={() => toggleType(opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </section>

          {/* Accounts */}
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Accounts</p>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {activeAccounts.map(a => (
                <Chip key={a.id} active={filterState.accountIds.includes(a.id)} onClick={() => toggleAccount(a.id)}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </span>
                </Chip>
              ))}
            </div>
          </section>

          {/* Categories */}
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Categories</p>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {categories.map(c => (
                <Chip key={c.id} active={filterState.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                  <span className="inline-flex items-center gap-1.5">
                    <CategoryIcon icon={c.icon} color={c.color} size={10} />
                    {c.name}
                  </span>
                </Chip>
              ))}
            </div>
          </section>

          {/* Date range */}
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Date range</p>
            <div className="flex gap-2 items-center mb-2">
              <DatePicker
                value={filterState.dateFrom}
                onChange={v => setFilter({ dateFrom: v })}
                placeholder="DD.MM.YYYY"
              />
              <span className="text-muted-foreground shrink-0">–</span>
              <DatePicker
                value={filterState.dateTo}
                onChange={v => setFilter({ dateTo: v })}
                placeholder="DD.MM.YYYY"
              />
            </div>
            {/* Quick presets */}
            <div className="flex gap-2">
              {([
                { label: 'This month', offset: 0 as const },
                { label: 'Last month', offset: -1 as const },
              ]).map(({ label, offset }) => {
                const range = getMonthRange(offset)
                const active = filterState.dateFrom === range.from && filterState.dateTo === range.to
                return (
                  <Chip
                    key={label}
                    active={active}
                    onClick={() => active
                      ? setFilter({ dateFrom: '', dateTo: '' })
                      : setFilter({ dateFrom: range.from, dateTo: range.to })
                    }
                  >
                    {label}
                  </Chip>
                )
              })}
            </div>
          </section>

          {/* Amount range */}
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Amount range</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Min"
                value={filterState.amountMin}
                onChange={e => setFilter({ amountMin: e.target.value })}
                className="flex-1 min-w-0 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:border-primary"
              />
              <span className="text-muted-foreground shrink-0">–</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Max"
                value={filterState.amountMax}
                onChange={e => setFilter({ amountMax: e.target.value })}
                className="flex-1 min-w-0 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:border-primary"
              />
            </div>
          </section>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={() => { clearFilters(); onClose() }}
              className="self-start text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </>
  )
}
