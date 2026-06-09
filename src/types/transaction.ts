export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'debt_lent'
  | 'debt_borrowed'

export interface Transaction {
  localId?: number
  id: string
  date: string
  time: string
  type: TransactionType
  amount: number
  currency: string
  amount_base: number
  account_id: string
  category_ids: string[]
  to_account_id: string
  to_amount: number
  to_currency: string
  debt_ref_id: string
  comment: string
  created_at: string
  updated_at: string
}

export type TransactionInput = Omit<Transaction, 'localId' | 'id' | 'created_at' | 'updated_at'>
