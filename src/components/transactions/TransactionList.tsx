import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionItem } from './TransactionItem'
import { TransactionModal } from './TransactionModal'
import { FilterBar } from '@/components/common/FilterBar'
import { useTransactionsByDate, useFilteredTransactions } from '@/hooks/useTransactions'
import { useAccountsStore } from '@/store/accountsStore'
import { useUIStore } from '@/store/uiStore'
import { usePrefsStore } from '@/store/prefsStore'
import { formatAmount } from '@/utils/currencyUtils'
import type { Transaction } from '@/types/transaction'

/** How many date-groups to render per page */
const PAGE_SIZE = 20

export function TransactionList() {
  const { filterState } = useUIStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = usePrefsStore()
  const allGroups = useTransactionsByDate()
  const filtered = useFilteredTransactions(filterState)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sentinelRef = useRef<HTMLDivElement>(null)

  // Total balance: sum non-archived, non-investment accounts
  const totalBalance = accounts
    .filter(a => !a.archived && a.type !== 'investment')
    .reduce((sum, a) => sum + a.balance, 0)

  const hasFilters = filterState.accountIds.length > 0 || filterState.types.length > 0 ||
    filterState.categoryIds.length > 0 || filterState.dateFrom || filterState.dateTo

  const allDisplayGroups = hasFilters
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
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [hasFilters, allGroups.length])

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
      {/* Balance bar */}
      <div className="px-4 py-3 border-b bg-secondary/30 flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Total balance</span>
        <span className="font-semibold">{formatAmount(totalBalance, baseCurrency)}</span>
      </div>

      {/* Active filter chips */}
      <FilterBar filterState={filterState} />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 text-muted-foreground">
            <Wallet size={40} className="opacity-20" />
            <p>No transactions yet</p>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>+ Add transaction</Button>
          </div>
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
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
      >
        <Plus size={24} />
      </button>

      <TransactionModal
        open={createOpen || editTx !== null}
        editing={editTx}
        onClose={() => { setCreateOpen(false); setEditTx(null) }}
      />
    </div>
  )
}
