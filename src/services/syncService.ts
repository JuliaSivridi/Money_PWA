import { fetchAllTransactions, appendTransaction, updateTransaction as apiUpdateTransaction, ensureTransactionHeader } from '@/api/transactionsApi'
import { fetchAllAccounts, appendAccount, updateAccount as apiUpdateAccount, ensureAccountHeader } from '@/api/accountsApi'
import { fetchAllCategories, appendCategory, updateCategory as apiUpdateCategory, ensureCategoryHeader } from '@/api/categoriesApi'
import { getPending, markProcessing, markDone, markFailed, getQueueLength } from '@/services/offlineQueue'
import { invalidateRowCache, deleteRowByEntityId } from '@/api/sheetsClient'
import { SHEET_TRANSACTIONS } from '@/utils/constants'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useAccountsStore } from '@/store/accountsStore'
import { useCategoriesStore } from '@/store/categoriesStore'
import { useSyncStore } from '@/store/syncStore'
import { now } from '@/utils/dateUtils'
import type { Transaction } from '@/types/transaction'
import type { Account } from '@/types/account'
import type { Category } from '@/types/category'

async function processQueueItem(item: Awaited<ReturnType<typeof getPending>>[number]): Promise<void> {
  const { entityType, operationType, payload } = item

  if (entityType === 'transaction') {
    const t = payload as unknown as Transaction
    if (operationType === 'create') await appendTransaction(t)
    else if (operationType === 'delete') await deleteRowByEntityId(SHEET_TRANSACTIONS, item.entityId)
    else await apiUpdateTransaction(t)
  } else if (entityType === 'account') {
    const a = payload as unknown as Account
    if (operationType === 'create') await appendAccount(a)
    else await apiUpdateAccount(a)
  } else if (entityType === 'category') {
    const c = payload as unknown as Category
    if (operationType === 'create') await appendCategory(c)
    else await apiUpdateCategory(c)
  }
}

export async function flush(): Promise<void> {
  const items = await getPending()
  if (items.length === 0) return

  const latestMap = new Map<string, typeof items[0]>()
  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}:${item.operationType}`
    const existing = latestMap.get(key)
    if (!existing || item.createdAt > existing.createdAt) latestMap.set(key, item)
  }
  const latestIds = new Set(Array.from(latestMap.values()).map(i => i.localId!))

  for (const item of items) {
    if (item.localId && !latestIds.has(item.localId)) await markDone(item.localId)
  }

  for (const item of latestMap.values()) {
    if (!item.localId) continue
    try {
      await markProcessing(item.localId)
      await processQueueItem(item)
      await markDone(item.localId)
    } catch (err) {
      console.error('Sync flush error', err)
      await markFailed(item.localId, item.retryCount + 1)
    }
  }

  invalidateRowCache()
  const pending = await getQueueLength()
  useSyncStore.getState().setPendingCount(pending)
}

export async function pull(): Promise<void> {
  // Another device may have reordered/removed rows since we cached their numbers
  invalidateRowCache()
  const [transactions, accounts, categories] = await Promise.all([
    fetchAllTransactions(),
    fetchAllAccounts(),
    fetchAllCategories(),
  ])
  // Entities with unsent local changes (e.g. a create that failed and awaits
  // retry) must not be deleted/overwritten by the pull — the local edit wins.
  const pendingIds = new Set((await getPending()).map(i => i.entityId))
  await Promise.all([
    useTransactionsStore.getState().upsertMany(transactions, pendingIds),
    useAccountsStore.getState().upsertMany(accounts),
    useCategoriesStore.getState().upsertMany(categories),
  ])
  useSyncStore.getState().setLastSyncAt(now())
}

export async function initialLoad(): Promise<void> {
  const sync = useSyncStore.getState()

  // Cache-first: show IndexedDB data instantly, then refresh from Sheets in
  // the background. Without this the user stares at "No transactions yet"
  // for the ~10 s the initial pull takes.
  await Promise.all([
    useTransactionsStore.getState().loadFromDb(),
    useAccountsStore.getState().loadFromDb(),
    useCategoriesStore.getState().loadFromDb(),
  ])

  sync.setSyncing(true)
  sync.setSyncError(null)
  try {
    await Promise.all([ensureTransactionHeader(), ensureAccountHeader(), ensureCategoryHeader()])
    await flush()
    await pull()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    sync.setSyncError(msg)
    await Promise.all([
      useTransactionsStore.getState().loadFromDb(),
      useAccountsStore.getState().loadFromDb(),
      useCategoriesStore.getState().loadFromDb(),
    ])
  } finally {
    sync.setSyncing(false)
    const pending = await getQueueLength()
    sync.setPendingCount(pending)
  }
}

let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _flushing = false

export function scheduleFlush(): void {
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    if (_flushing) return
    _flushing = true
    flush().finally(() => { _flushing = false })
  }, 800)
}

export async function fullSync(): Promise<void> {
  const sync = useSyncStore.getState()
  if (sync.isSyncing) return
  sync.setSyncing(true)
  sync.setSyncError(null)
  try {
    await flush()
    await pull()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    sync.setSyncError(msg)
  } finally {
    sync.setSyncing(false)
    const pending = await getQueueLength()
    sync.setPendingCount(pending)
  }
}

export async function clearLocalData(): Promise<void> {
  const { db } = await import('./db')
  await Promise.all([
    db.transactions.clear(),
    db.accounts.clear(),
    db.categories.clear(),
    db.queue.clear(),
  ])
  useTransactionsStore.setState({ transactions: [] })
  useAccountsStore.setState({ accounts: [] })
  useCategoriesStore.setState({ categories: [] })
  useSyncStore.getState().setPendingCount(0)
}
