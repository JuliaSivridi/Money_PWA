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

  const txnCategories = t.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean)
  const primaryCategory = txnCategories[0]
  const account = accounts.find(a => a.id === t.account_id)
  const toAccount = accounts.find(a => a.id === t.to_account_id)

  const isTransfer = t.type === 'transfer'
  const isIncome = t.type === 'income' || t.type === 'debt_borrowed'
  const isExpense = t.type === 'expense' || t.type === 'debt_lent'

  const crossCurrency = isTransfer && t.to_currency && t.to_currency !== t.currency

  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 w-full px-4 py-3 hover:bg-accent transition-colors text-left"
    >
      {/* Icon(s) */}
      {isTransfer ? (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <Redo2 className="w-5 h-5 text-muted-foreground" />
        </div>
      ) : txnCategories.length > 1 ? (
        // Stacked icons — second slightly offset behind first
        <div className="relative flex-shrink-0 w-10 h-10 mt-0.5">
          <div className="absolute top-0 left-0 translate-x-2 translate-y-1 opacity-70">
            <CategoryIcon icon={txnCategories[1]!.icon} color={txnCategories[1]!.color} size={20} />
          </div>
          <div className="absolute top-0 left-0">
            <CategoryIcon icon={txnCategories[0]!.icon} color={txnCategories[0]!.color} size={28} />
          </div>
        </div>
      ) : primaryCategory ? (
        <div className="flex-shrink-0 mt-0.5">
          <CategoryIcon icon={primaryCategory.icon} color={primaryCategory.color} size={28} />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 mt-0.5" />
      )}

      {/* Name + account lines */}
      <div className="flex-1 min-w-0">
        <p className="truncate">
          {isTransfer
            ? (toAccount?.name ?? '?')
            : primaryCategory
              ? (t.comment ? `${primaryCategory.name} · ${t.comment}` : primaryCategory.name)
              : (t.comment ?? t.type)}
        </p>
        <p className="text-xs truncate font-medium">
          {t.time && t.time !== '00:00' && (
            <span className="text-muted-foreground">{t.time} · </span>
          )}
          <span style={{ color: account?.color || '#6b7280' }}>{account?.name ?? ''}</span>
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
