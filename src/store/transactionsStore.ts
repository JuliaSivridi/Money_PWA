import { create } from 'zustand'
import { db } from '@/services/db'
import { enqueue } from '@/services/offlineQueue'
import { scheduleFlush } from '@/services/syncService'
import { generateId } from '@/utils/uuid'
import { now } from '@/utils/dateUtils'
import { convertToBase } from '@/utils/currencyUtils'
import { useAccountsStore } from './accountsStore'
import { useExchangeRateStore } from './exchangeRateStore'
import { usePrefsStore } from './prefsStore'
import type { Transaction, TransactionInput } from '@/types/transaction'

function computeBalanceDelta(t: Transaction): { accountId: string; delta: number; toAccountId?: string; toDelta?: number } {
  switch (t.type) {
    case 'expense':       return { accountId: t.account_id, delta: -t.amount }
    case 'income':        return { accountId: t.account_id, delta: t.amount }
    case 'transfer':      return { accountId: t.account_id, delta: -t.amount, toAccountId: t.to_account_id, toDelta: t.to_amount }
    case 'debt_lent':     return { accountId: t.account_id, delta: t.debt_ref_id ? t.amount : -t.amount }
    case 'debt_borrowed': return { accountId: t.account_id, delta: t.debt_ref_id ? -t.amount : t.amount }
    default:              return { accountId: t.account_id, delta: 0 }
  }
}

interface TransactionsState {
  transactions: Transaction[]
  addTransaction: (input: TransactionInput) => Promise<Transaction>
  updateTransaction: (id: string, patch: Partial<TransactionInput>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  upsertMany: (incoming: Transaction[], protectedIds?: Set<string>) => Promise<void>
  loadFromDb: () => Promise<void>
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],

  addTransaction: async (input) => {
    const ts = now()
    const { rates, baseCurrency } = useExchangeRateStore.getState()
    const { baseCurrency: prefBase } = usePrefsStore.getState()
    const base = prefBase || baseCurrency
    const amount_base = convertToBase(input.amount, input.currency, base, rates)
    const t: Transaction = { ...input, id: generateId('txn'), amount_base, created_at: ts, updated_at: ts }

    await db.transactions.add(t)
    await enqueue('transaction', 'create', t.id, t as unknown as Record<string, unknown>)
    set((s) => ({ transactions: [t, ...s.transactions] }))

    const d = computeBalanceDelta(t)
    await useAccountsStore.getState().adjustBalance(d.accountId, d.delta)
    if (d.toAccountId && d.toDelta != null) {
      await useAccountsStore.getState().adjustBalance(d.toAccountId, d.toDelta)
    }

    scheduleFlush()
    return t
  },

  updateTransaction: async (id, patch) => {
    const existing = get().transactions.find(t => t.id === id)
    if (!existing) return

    // Reverse old balance effect
    const oldDelta = computeBalanceDelta(existing)
    await useAccountsStore.getState().adjustBalance(oldDelta.accountId, -oldDelta.delta)
    if (oldDelta.toAccountId && oldDelta.toDelta != null) {
      await useAccountsStore.getState().adjustBalance(oldDelta.toAccountId, -oldDelta.toDelta)
    }

    const { rates, baseCurrency } = useExchangeRateStore.getState()
    const { baseCurrency: prefBase } = usePrefsStore.getState()
    const base = prefBase || baseCurrency
    const merged = { ...existing, ...patch }
    const amount_base = convertToBase(merged.amount, merged.currency, base, rates)
    const updated: Transaction = { ...merged, amount_base, updated_at: now() }

    await db.transactions.where('id').equals(id).modify(t => { Object.assign(t, updated) })
    await enqueue('transaction', 'update', id, updated as unknown as Record<string, unknown>)
    set((s) => ({ transactions: s.transactions.map(t => t.id === id ? updated : t) }))

    // Apply new balance effect
    const newDelta = computeBalanceDelta(updated)
    await useAccountsStore.getState().adjustBalance(newDelta.accountId, newDelta.delta)
    if (newDelta.toAccountId && newDelta.toDelta != null) {
      await useAccountsStore.getState().adjustBalance(newDelta.toAccountId, newDelta.toDelta)
    }

    scheduleFlush()
  },

  deleteTransaction: async (id) => {
    const existing = get().transactions.find(t => t.id === id)
    if (!existing) return

    // Reverse balance effect
    const d = computeBalanceDelta(existing)
    await useAccountsStore.getState().adjustBalance(d.accountId, -d.delta)
    if (d.toAccountId && d.toDelta != null) {
      await useAccountsStore.getState().adjustBalance(d.toAccountId, -d.toDelta)
    }

    await db.transactions.where('id').equals(id).delete()
    await enqueue('transaction', 'delete', id, existing as unknown as Record<string, unknown>)
    set((s) => ({ transactions: s.transactions.filter(t => t.id !== id) }))
    scheduleFlush()
  },

  upsertMany: async (incoming, protectedIds) => {
    const { rates, baseCurrency: rateBase } = useExchangeRateStore.getState()
    const { baseCurrency: prefBase } = usePrefsStore.getState()
    const base = prefBase || rateBase

    // Fix amount_base when Sheets stored the raw amount instead of base-currency equivalent.
    // Condition: non-base currency AND (amount_base is zero OR equals amount — both indicate no conversion).
    const corrected = incoming.map(t => {
      if (t.currency !== base && rates[t.currency] && (t.amount_base === 0 || t.amount_base === t.amount)) {
        return { ...t, amount_base: convertToBase(t.amount, t.currency, base, rates) }
      }
      return t
    })

    const existing = await db.transactions.toArray()
    const incomingIds = new Set(corrected.map(t => t.id))
    const existingMap = new Map(existing.map(t => [t.id, t]))

    // Delete records that exist locally but are gone from Sheets —
    // except those still waiting in the sync queue (created/edited offline)
    const toDelete = existing
      .filter(t => !incomingIds.has(t.id) && !protectedIds?.has(t.id))
      .map(t => t.id)
    if (toDelete.length > 0) await db.transactions.bulkDelete(toDelete)

    // Upsert records that are new, updated, or had amount_base corrected
    const toStore = corrected.filter(item => {
      if (protectedIds?.has(item.id)) return false
      const local = existingMap.get(item.id)
      if (!local) return true
      if (item.amount_base !== local.amount_base) return true
      return item.updated_at > local.updated_at
    })
    if (toStore.length > 0) await db.transactions.bulkPut(toStore)

    const all = await db.transactions.toArray()
    set({ transactions: all.sort((a, b) => b.date.localeCompare(a.date)) })
  },

  loadFromDb: async () => {
    const all = await db.transactions.toArray()
    set({ transactions: all.sort((a, b) => b.date.localeCompare(a.date)) })
  },
}))
