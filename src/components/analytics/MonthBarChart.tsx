import { useMemo } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useUIStore } from '@/store/uiStore'
import { format, subMonths } from 'date-fns'

export function MonthBarChart() {
  const { transactions } = useTransactionsStore()
  const { analyticsMonth, setAnalyticsMonth } = useUIStore()

  const data = useMemo(() => {
    const months: { month: string; label: string; total: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const month = format(d, 'yyyy-MM')
      const label = format(d, 'MMM')
      const total = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(month))
        .reduce((sum, t) => sum + t.amount_base, 0)
      months.push({ month, label, total })
    }
    return months
  }, [transactions])

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} onClick={(e) => { if (e?.activePayload?.[0]) { const d = e.activePayload[0].payload as { month: string }; setAnalyticsMonth(d.month) } }}>
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <Bar dataKey="total" radius={[3, 3, 0, 0]} cursor="pointer">
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={`hsl(var(--primary)${entry.month === analyticsMonth ? ')' : ' / 0.35)'}`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
