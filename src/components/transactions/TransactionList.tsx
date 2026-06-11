import { useState, useEffect, useRef, useCallback } from 'react'
import { Wallet, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FAB } from '@/components/common/FAB'
import { FilterPanel } from '@/components/common/FilterPanel'
import { TransactionItem } from './TransactionItem'
import { TransactionModal } from './TransactionModal'
import { FilterBar } from '@/components/common/FilterBar'
import { useTransactionsByDate, useFilteredTransactions } from '@/hooks/useTransactions'
import { useUIStore } from '@/store/uiStore'
import { useSyncStore } from '@/store/syncStore'
import type { Transaction } from '@/types/transaction'

/** How many date-groups to render per page */
const PAGE_SIZE = 20

export function TransactionList() {
  const { filterState, filterPanelOpen, setFilterPanelOpen, searchQuery } = useUIStore()
  const allGroups = useTransactionsByDate()
  const filtered = useFilteredTransactions(filterState, searchQuery)

  const { isSyncing } = useSyncStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [copyTx, setCopyTx] = useState<Transaction | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sentinelRef = useRef<HTMLDivElement>(null)

  const hasFilters = filterState.accountIds.length > 0 || filterState.types.length > 0 ||
    filterState.categoryIds.length > 0 || filterState.dateFrom || filterState.dateTo

  const isFiltering = hasFilters || searchQuery.trim() !== ''

  const allDisplayGroups = isFiltering
    ? (() => {
        const groups = new Map<string, typeof allGroups[0]>()
        for (const g of allGroups) {
          const txns = g.transactions.filter(t => filtered.some(f => f.id === t.id))
          if (txns.length > 0) groups.set(g.date, { ...g, transactions: txns })
        }
        return Array.from(groups.values())
      })()
    : allGroups

  // Reset visible count when filter/data changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [isFiltering, allGroups.length])

  const displayGroups = allDisplayGroups.slice(0, visibleCount)
  const hasMore = visibleCount < allDisplayGroups.length

  // IntersectionObserver — load next page when sentinel scrolls into view
  const loadMore = useCallback(() => {
    setVisibleCount(n => Math.min(n + PAGE_SIZE, allDisplayGroups.length))
  }, [allDisplayGroups.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div className="flex flex-col h-full">
      {/* Active filter chips */}
      {hasFilters && (
        <div className="px-3 py-1.5 border-b">
          <FilterBar filterState={filterState} inline />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {displayGroups.length === 0 ? (
          // First-ever sync has nothing cached yet — show progress, not a
          // scary "No transactions yet"
          isSyncing ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 text-muted-foreground">
              <RefreshCw size={32} className="opacity-40 animate-spin" />
              <p>Loading your transactions…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 text-muted-foreground">
              <Wallet size={40} className="opacity-20" />
              <p>No transactions yet</p>
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>+ Add transaction</Button>
            </div>
          )
        ) : (
          <>
            {displayGroups.map(group => (
              <div key={group.date}>
                <div className="px-4 pt-4 pb-1">
                  <span className="text-sm font-bold">{group.label}</span>
                </div>
                {group.transactions.map(t => (
                  <TransactionItem key={t.id} transaction={t} onClick={() => setEditTx(t)} />
                ))}
              </div>
            ))}

            {/* Sentinel — observed by IntersectionObserver */}
            {hasMore && (
              <div ref={sentinelRef} className="py-4 flex justify-center">
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            )}
          </>
        )}
      </div>

      <FAB onClick={() => setCreateOpen(true)} />

      <TransactionModal
        open={createOpen || editTx !== null}
        editing={editTx}
        onClose={() => { setCreateOpen(false); setEditTx(null) }}
        onCopy={(tx) => { setEditTx(null); setCopyTx(tx) }}
      />
      <TransactionModal
        open={copyTx !== null}
        copyFrom={copyTx}
        onClose={() => setCopyTx(null)}
      />
      <FilterPanel open={filterPanelOpen} onClose={() => setFilterPanelOpen(false)} />
    </div>
  )
}
