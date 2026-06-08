export interface Category {
  localId?: number
  id: string
  name: string
  icon: string
  color: string
  is_expense: boolean
  expense_limit: number
  is_income: boolean
  income_limit: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type CategoryInput = Omit<Category, 'localId' | 'id' | 'created_at' | 'updated_at'>
