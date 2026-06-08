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
    this.version(1).stores({
      transactions: '++localId, id, date, type, account_id, category_id, updated_at',
      accounts:     '++localId, id, type, archived, updated_at',
      categories:   '++localId, id, sort_order, updated_at',
      queue:        '++localId, status, entityType, entityId, createdAt',
    })
  }
}

export const db = new MoneyDB()
