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

const AMOUNT_COLORS: Record<string, string> = {
  expense: 'text-red-400',
  debt_lent: 'text-red-400',
  income: 'text-green-400',
  debt_borrowed: 'text-green-400',
  transfer: 'text-gray-400',
}

function amountSign(type: string): string {
  if (type === 'income' || type === 'debt_borrowed') return '+'
  if (type === 'expense' || type === 'debt_lent') return '−'
  return ''
}

export function TransactionItem({ transaction: t, onClick }: Props) {
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()

  const category = categories.find(c => c.id === t.category_id)
  const account = accounts.find(a => a.id === t.account_id)
  const toAccount = accounts.find(a => a.id === t.to_account_id)

  const displayName = t.type === 'transfer'
    ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
    : category?.name ?? t.comment ?? t.type

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-accent transition-colors text-left"
    >
      {category ? (
        <CategoryIcon icon={category.icon} color={category.color} />
      ) : (
        <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="truncate">{displayName}</p>
        <p className="text-muted-foreground text-xs truncate">{account?.name ?? ''}</p>
      </div>

      <span className={cn('font-medium flex-shrink-0', AMOUNT_COLORS[t.type] ?? 'text-foreground')}>
        {amountSign(t.type)}{formatAmount(t.amount, t.currency)}
      </span>
    </button>
  )
}
