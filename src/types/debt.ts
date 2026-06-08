export interface DebtSummary {
  counterpart: string
  type: 'lent' | 'borrowed'
  totalAmount: number
  currency: string
  transactions: string[]
}
