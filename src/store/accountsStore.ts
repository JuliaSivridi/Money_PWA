import { create } from 'zustand'
import { db } from '@/services/db'
import { enqueue } from '@/services/offlineQueue'
import { generateId } from '@/utils/uuid'
import { now } from '@/utils/dateUtils'
import type { Account, AccountInput } from '@/types/account'

interface AccountsState {
  accounts: Account[]
  addAccount: (input: AccountInput) => Promise<Account>
  updateAccount: (id: string, patch: Partial<AccountInput>) => Promise<void>
  archiveAccount: (id: string) => Promise<void>
  adjustBalance: (id: string, delta: number) => Promise<void>
  upsertMany: (incoming: Account[]) => Promise<void>
  loadFromDb: () => Promise<void>
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],

  addAccount: async (input) => {
    const ts = now()
    const account: Account = { ...input, id: generateId('acc'), created_at: ts, updated_at: ts }
    await db.accounts.add(account)
    await enqueue('account', 'create', account.id, account as unknown as Record<string, unknown>)
    set((s) => ({ accounts: [...s.accounts, account] }))
    return account
  },

  updateAccount: async (id, patch) => {
    const existing = get().accounts.find(a => a.id === id)
    if (!existing) return
    const updated: Account = { ...existing, ...patch, updated_at: now() }
    await db.accounts.where('id').equals(id).modify(updated)
    await enqueue('account', 'update', id, updated as unknown as Record<string, unknown>)
    set((s) => ({ accounts: s.accounts.map(a => a.id === id ? updated : a) }))
  },

  archiveAccount: async (id) => {
    await get().updateAccount(id, { archived: true })
  },

  adjustBalance: async (id, delta) => {
    if (delta === 0) return
    const existing = get().accounts.find(a => a.id === id)
    if (!existing) return
    const newBalance = Math.round((existing.balance + delta) * 100) / 100
    const updated: Account = { ...existing, balance: newBalance, updated_at: now() }
    await db.accounts.where('id').equals(id).modify({ balance: updated.balance, updated_at: updated.updated_at })
    await enqueue('account', 'update', id, updated as unknown as Record<string, unknown>)
    set((s) => ({ accounts: s.accounts.map(a => a.id === id ? updated : a) }))
  },

  upsertMany: async (incoming) => {
    const existing = await db.accounts.toArray()
    const incomingIds = new Set(incoming.map(a => a.id))
    const existingMap = new Map(existing.map(a => [a.id, a]))

    const toDelete = existing.filter(a => !incomingIds.has(a.id)).map(a => a.id)
    if (toDelete.length > 0) await db.accounts.bulkDelete(toDelete)

    const toStore = incoming.filter(item => {
      const local = existingMap.get(item.id)
      return !local || item.updated_at > local.updated_at
    })
    if (toStore.length > 0) await db.accounts.bulkPut(toStore)

    const all = await db.accounts.toArray()
    set({ accounts: all.sort((a, b) => a.sort_order - b.sort_order) })
  },

  loadFromDb: async () => {
    const all = await db.accounts.toArray()
    set({ accounts: all.sort((a, b) => a.sort_order - b.sort_order) })
  },
}))
