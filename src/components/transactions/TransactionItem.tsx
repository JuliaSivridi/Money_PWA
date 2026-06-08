import { Redo2 } from 'lucide-react'
import { useCategoriesStore } from '@/store/categoriesStore'
import { useAccountsStore } from '@/store/accountsStore'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { formatAmount } from '@/utils/currencyUtils'
import type { Transaction } from '@/types/transaction'
import { cn } from '@/lib/utils'

interface Props {
  transaction: Transaction
  onClick: () => void
}

export function TransactionItem({ transaction: t, onClick }: Props) {
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()

  const category = categories.find(c => c.id === t.category_id)
  const account = accounts.find(a => a.id === t.account_id)
  const toAccount = accounts.find(a => a.id === t.to_account_id)

  const isTransfer = t.type === 'transfer'
  const isIncome = t.type === 'income' || t.type === 'debt_borrowed'
  const isExpense = t.type === 'expense' || t.type === 'debt_lent'

  const crossCurrency = isTransfer && t.to_currency && t.to_currency !== t.currency

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-accent transition-colors text-left"
    >
      {/* Icon */}
      {isTransfer ? (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Redo2 className="w-4 h-4 text-muted-foreground" />
        </div>
      ) : category ? (
        <CategoryIcon icon={category.icon} color={category.color} />
      ) : (
        <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
      )}

      {/* Name + account lines */}
      <div className="flex-1 min-w-0">
        <p className="truncate">
          {isTransfer ? (toAccount?.name ?? '?') : (category?.name ?? t.comment ?? t.type)}
        </p>
        <p className="text-muted-foreground text-xs truncate">
          {account?.name ?? ''}
        </p>
      </div>

      {/* Amount(s) */}
      <div className="text-right flex-shrink-0">
        {isTransfer ? (
          crossCurrency ? (
            <>
              <p className="font-medium text-green-400">
                +{formatAmount(t.to_amount || t.amount, t.to_currency || t.currency)}
              </p>
              <p className="text-xs text-red-400">
                −{formatAmount(t.amount, t.currency)}
              </p>
            </>
          ) : (
            <p className="font-medium text-muted-foreground">
              {formatAmount(t.amount, t.currency)}
            </p>
          )
        ) : (
          <p className={cn('font-medium', isIncome ? 'text-green-400' : isExpense ? 'text-red-400' : 'text-foreground')}>
            {isIncome ? '+' : isExpense ? '−' : ''}{formatAmount(t.amount, t.currency)}
          </p>
        )}
      </div>
    </button>
  )
}
