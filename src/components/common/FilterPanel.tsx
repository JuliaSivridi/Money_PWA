import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CategoryIcon } from './CategoryIcon'
import { useUIStore } from '@/store/uiStore'
import { useAccountsStore } from '@/store/accountsStore'
import { useCategoriesStore } from '@/store/categoriesStore'

interface Props {
  open: boolean
  onClose: () => void
}

const TYPE_OPTIONS = [
  { value: 'expense',       label: 'Expense' },
  { value: 'income',        label: 'Income' },
  { value: 'transfer',      label: 'Transfer' },
  { value: 'debt_lent',     label: 'Debt lent' },
  { value: 'debt_borrowed', label: 'Debt borrowed' },
] as const

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
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

  // Local state mirrors filterState while panel is open
  const [local, setLocal] = useState(filterState)
  useEffect(() => { if (open) setLocal(filterState) }, [open, filterState])

  const patch = (p: Partial<typeof local>) => setLocal(s => ({ ...s, ...p }))

  const toggleAccount = (id: string) =>
    patch({ accountIds: local.accountIds.includes(id) ? local.accountIds.filter(x => x !== id) : [...local.accountIds, id] })
  const toggleType = (t: string) =>
    patch({ types: local.types.includes(t) ? local.types.filter(x => x !== t) : [...local.types, t] })
  const toggleCategory = (id: string) =>
    patch({ categoryIds: local.categoryIds.includes(id) ? local.categoryIds.filter(x => x !== id) : [...local.categoryIds, id] })

  const handleApply = () => {
    setFilter(local)
    onClose()
  }

  const handleClear = () => {
    clearFilters()
    onClose()
  }

  const activeAccounts = accounts.filter(a => !a.archived)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Type */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(opt => (
                <Toggle key={opt.value} active={local.types.includes(opt.value)} onClick={() => toggleType(opt.value)}>
                  {opt.label}
                </Toggle>
              ))}
            </div>
          </section>

          {/* Accounts */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Accounts</p>
            <div className="flex flex-wrap gap-2">
              {activeAccounts.map(a => (
                <Toggle key={a.id} active={local.accountIds.includes(a.id)} onClick={() => toggleAccount(a.id)}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </span>
                </Toggle>
              ))}
            </div>
          </section>

          {/* Categories */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <Toggle key={c.id} active={local.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                  <span className="inline-flex items-center gap-1.5">
                    <CategoryIcon icon={c.icon} color={c.color} size={10} />
                    {c.name}
                  </span>
                </Toggle>
              ))}
            </div>
          </section>

          {/* Date range */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Date range</p>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={local.dateFrom}
                onChange={e => patch({ dateFrom: e.target.value })}
                className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-background"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="date"
                value={local.dateTo}
                onChange={e => patch({ dateTo: e.target.value })}
                className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-background"
              />
            </div>
          </section>

          {/* Amount range */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Amount range</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Min"
                value={local.amountMin}
                onChange={e => patch({ amountMin: e.target.value })}
                className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-background"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Max"
                value={local.amountMax}
                onChange={e => patch({ amountMax: e.target.value })}
                className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-background"
              />
            </div>
          </section>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button type="button" variant="ghost" onClick={handleClear} className="mr-auto">
            Clear all
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
