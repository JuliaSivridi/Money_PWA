import Dexie, { type Table } from 'dexie'
import type { Transaction } from '@/types/transaction'
import type { Account } from '@/types/account'
import type { Category } from '@/types/category'
import type { QueueItem } from '@/types/sync'

export class MoneyDB extends Dexie {
  transactions!: Table<Transaction>
  accounts!:     Table<Account>
  categories!:   Table<Category>
  queue!:        Table<QueueItem>

  constructor() {
    // New name MoneyDB2 — avoids Dexie's "cannot change primary key" error
    // when upgrading from v1 (++localId) to v2 (id). Old MoneyDB is abandoned;
    // data re-syncs from Sheets automatically.
    super('MoneyDB2')
    this.version(1).stores({
      transactions: 'id, date, type, account_id, category_id, updated_at',
      accounts:     'id, type, archived, updated_at',
      categories:   'id, sort_order, updated_at',
      queue:        '++localId, status, entityType, entityId, createdAt',
    })
  }
}

export const db = new MoneyDB()
