import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useCategoriesStore } from '@/store/categoriesStore'
import { usePrefsStore } from '@/store/prefsStore'
import { formatAmount } from '@/utils/currencyUtils'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { BarChart2 } from 'lucide-react'

interface Props {
  month: string
}

export function CategoryDonut({ month }: Props) {
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = usePrefsStore()

  const { data, total } = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(month))
    const byCategory = new Map<string, number>()
    for (const t of expenses) {
      // Use primary category (first in array) for analytics totals — avoids double-counting
      const primaryId = t.category_ids[0]
      if (primaryId) byCategory.set(primaryId, (byCategory.get(primaryId) ?? 0) + t.amount_base)
    }
    const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0)
    const data = categories
      .filter(c => byCategory.has(c.id))
      .map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, amount: byCategory.get(c.id)!, limit: c.expense_limit }))
    return { data, total }
  }, [transactions, categories, month])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <BarChart2 size={40} className="opacity-20" />
        <p>No data for this month</p>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {data.map(entry => <Cell key={entry.id} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-lg font-bold">{formatAmount(total, baseCurrency)}</span>
          <span className="text-xs text-muted-foreground">expenses</span>
        </div>
      </div>

      <div className="mt-4 space-y-2 px-4">
        {data.map(item => {
          const pct = item.limit > 0 ? Math.min(item.amount / item.limit, 1) : 0
          const exceeded = item.limit > 0 && item.amount > item.limit
          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <CategoryIcon icon={item.icon} color={item.color} size={14} />
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-sm font-medium">{formatAmount(item.amount, baseCurrency)}</span>
                {item.limit > 0 && (
                  <span className={`text-xs ${exceeded ? 'text-red-400' : 'text-green-400'}`}>
                    {exceeded ? '✗' : '✓'} {formatAmount(item.limit, baseCurrency)}
                  </span>
                )}
              </div>
              {item.limit > 0 && (
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${exceeded ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${pct * 100}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
