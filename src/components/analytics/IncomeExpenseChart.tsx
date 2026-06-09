import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useTransactionsStore } from '@/store/transactionsStore'
import { usePrefsStore } from '@/store/prefsStore'
import { format, subMonths } from 'date-fns'
import { formatAmount } from '@/utils/currencyUtils'

export function IncomeExpenseChart() {
  const { transactions } = useTransactionsStore()
  const { baseCurrency } = usePrefsStore()

  const data = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i)
      const month = format(d, 'yyyy-MM')
      const label = format(d, 'MMM')
      const income = transactions
        .filter(t => t.type === 'income' && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount_base, 0)
      const expense = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount_base, 0)
      return { month, label, income, expense, net: income - expense }
    })
  }, [transactions])

  return (
    <div className="px-4 py-4">
      <h2 className="font-semibold mb-4">Income vs Expenses</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis hide />
          <Tooltip
            formatter={(value: number, name: string) => [formatAmount(value, baseCurrency), name]}
            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          />
          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
          <Bar dataKey="income" name="Income" fill="hsl(var(--chart-2, 142 71% 45%))" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="hsl(var(--chart-1, 0 72% 51%))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Net savings row */}
      <div className="mt-4 space-y-1.5">
        {data.slice(-3).reverse().map(d => (
          <div key={d.month} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{d.label}</span>
            <span className={d.net >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
              {d.net >= 0 ? '+' : ''}{formatAmount(d.net, baseCurrency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
