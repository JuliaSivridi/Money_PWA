import { useMemo } from 'react'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useUIStore, type FilterState } from '@/store/uiStore'
import { format, parseISO, getYear } from 'date-fns'
import type { Transaction } from '@/types/transaction'

function formatGroupLabel(date: string): string {
  const d = parseISO(date)
  const currentYear = getYear(new Date())
  const datePart = getYear(d) === currentYear
    ? format(d, 'dd MMM')
    : format(d, 'dd MMM yyyy')
  return `${datePart} · ${format(d, 'EEEE')}`
}

export interface DateGroup {
  date: string
  label: string
  transactions: Transaction[]
  dailyNet: number
}

export function useTransactionsByDate(): DateGroup[] {
  const { transactions } = useTransactionsStore()
  return useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const existing = groups.get(t.date) ?? []
      existing.push(t)
      groups.set(t.date, existing)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, txns]) => {
        let dailyNet = 0
        for (const t of txns) {
          if (t.type === 'income') dailyNet += t.amount_base
          else if (t.type === 'expense') dailyNet -= t.amount_base
        }
        return {
          date,
          label: formatGroupLabel(date),
          transactions: txns,
          dailyNet,
        }
      })
  }, [transactions])
}

export function useFilteredTransactions(filterState: FilterState): Transaction[] {
  const { transactions } = useTransactionsStore()
  return useMemo(() => {
    return transactions.filter(t => {
      if (filterState.accountIds.length > 0 && !filterState.accountIds.includes(t.account_id)) return false
      if (filterState.types.length > 0 && !filterState.types.includes(t.type)) return false
      if (filterState.categoryIds.length > 0 && !filterState.categoryIds.includes(t.category_id)) return false
      if (filterState.dateFrom && t.date < filterState.dateFrom) return false
      if (filterState.dateTo && t.date > filterState.dateTo) return false
      return true
    })
  }, [transactions, filterState])
}

export function useTotalBalance(): number {
  const { transactions } = useTransactionsStore()
  const { filterState } = useUIStore()
  return useMemo(() => {
    const filtered = transactions.filter(t => {
      if (filterState.accountIds.length > 0 && !filterState.accountIds.includes(t.account_id)) return false
      return true
    })
    return filtered.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount_base
      if (t.type === 'expense') return sum - t.amount_base
      return sum
    }, 0)
  }, [transactions, filterState])
}
