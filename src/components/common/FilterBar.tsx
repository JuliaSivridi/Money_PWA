import { X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAccountsStore } from '@/store/accountsStore'
import { useCategoriesStore } from '@/store/categoriesStore'
import type { FilterState } from '@/store/uiStore'

const TYPES = ['expense', 'income', 'transfer', 'debt_lent', 'debt_borrowed'] as const

interface Props {
  filterState: FilterState
  inline?: boolean
}

export function FilterBar({ filterState, inline }: Props) {
  const { setFilter, clearFilters } = useUIStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()

  const hasFilters = filterState.accountIds.length > 0 || filterState.types.length > 0 ||
    filterState.categoryIds.length > 0 || filterState.dateFrom || filterState.dateTo ||
    filterState.amountMin !== '' || filterState.amountMax !== ''

  if (!hasFilters) return null

  const removeAccount = (id: string) =>
    setFilter({ accountIds: filterState.accountIds.filter(a => a !== id) })
  const removeType = (t: string) =>
    setFilter({ types: filterState.types.filter(x => x !== t) })
  const removeCategory = (id: string) =>
    setFilter({ categoryIds: filterState.categoryIds.filter(c => c !== id) })
  const removeDateFrom = () => setFilter({ dateFrom: '' })
  const removeDateTo = () => setFilter({ dateTo: '' })
  const removeAmountMin = () => setFilter({ amountMin: '' })
  const removeAmountMax = () => setFilter({ amountMax: '' })

  const chips = (
    <>
      {filterState.accountIds.map(id => {
        const acc = accounts.find(a => a.id === id)
        return acc ? <Chip key={id} label={acc.name} onRemove={() => removeAccount(id)} /> : null
      })}
      {filterState.types.map(t => (
        <Chip key={t} label={t.replace('_', ' ')} onRemove={() => removeType(t)} />
      ))}
      {filterState.categoryIds.map(id => {
        const cat = categories.find(c => c.id === id)
        return cat ? <Chip key={id} label={cat.name} onRemove={() => removeCategory(id)} /> : null
      })}
      {filterState.dateFrom && <Chip label={`From ${filterState.dateFrom}`} onRemove={removeDateFrom} />}
      {filterState.dateTo && <Chip label={`To ${filterState.dateTo}`} onRemove={removeDateTo} />}
      {filterState.amountMin !== '' && <Chip label={`≥ ${filterState.amountMin}`} onRemove={removeAmountMin} />}
      {filterState.amountMax !== '' && <Chip label={`≤ ${filterState.amountMax}`} onRemove={removeAmountMax} />}
      <button onClick={clearFilters} className="ml-1 shrink-0 text-sm text-muted-foreground hover:text-foreground underline whitespace-nowrap">
        Clear all
      </button>
    </>
  )

  if (inline) {
    return <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap flex-1">{chips}</div>
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-b overflow-x-auto scrollbar-none flex-nowrap">
      {chips}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm px-2 py-1 rounded-full whitespace-nowrap shrink-0">
      {label}
      <button onClick={onRemove} className="hover:opacity-70">
        <X size={11} />
      </button>
    </span>
  )
}

// Re-export TYPES so FilterBar can be used to add filter chips from a parent
export { TYPES }
