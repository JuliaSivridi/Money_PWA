export type AccountType = 'card' | 'cash' | 'savings' | 'investment'

export interface Account {
  localId?: number
  id: string
  name: string
  currency: string
  type: AccountType
  balance: number
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type AccountInput = Omit<Account, 'localId' | 'id' | 'created_at' | 'updated_at'>
