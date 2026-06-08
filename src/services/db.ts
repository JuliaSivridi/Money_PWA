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
    super('MoneyDB')
    // v1 used ++localId (auto-increment) as primary key — bulkPut could not upsert by entity id,
    // causing duplicates on every sync. v2 uses the entity id as primary key.
    this.version(1).stores({
      transactions: '++localId, id, date, type, account_id, category_id, updated_at',
      accounts:     '++localId, id, type, archived, updated_at',
      categories:   '++localId, id, sort_order, updated_at',
      queue:        '++localId, status, entityType, entityId, createdAt',
    })
    this.version(2).stores({
      transactions: 'id, date, type, account_id, category_id, updated_at',
      accounts:     'id, type, archived, updated_at',
      categories:   'id, sort_order, updated_at',
      queue:        '++localId, status, entityType, entityId, createdAt',
    })
  }
}

export const db = new MoneyDB()
