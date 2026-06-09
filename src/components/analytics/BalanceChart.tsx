import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useAccountsStore } from '@/store/accountsStore'
import { usePrefsStore } from '@/store/prefsStore'
import { formatAmount } from '@/utils/currencyUtils'
import { format, subMonths, parseISO } from 'date-fns'

export function BalanceChart() {
  const { transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = usePrefsStore()

  // Current total balance in base currency (sum of all non-archived accounts)
  const currentBalance = accounts
    .filter(a => !a.archived)
    .reduce((s, a) => s + (a.currency === baseCurrency ? a.balance : a.balance), 0)

  const data = useMemo(() => {
    const now = new Date()
    // Build monthly net change from transactions (base currency)
    const monthlyNet: Record<string, number> = {}
    for (const t of transactions) {
      const month = t.date.slice(0, 7)
      const delta =
        t.type === 'income' ? t.amount_base
        : t.type === 'expense' ? -t.amount_base
        : 0
      monthlyNet[month] = (monthlyNet[month] ?? 0) + delta
    }

    // Walk backwards from current balance to reconstruct historical balances
    const months = Array.from({ length: 13 }, (_, i) => {
      const d = subMonths(now, 12 - i)
      return format(d, 'yyyy-MM')
    })

    // current balance is "now"; subtract future months' net to get past balances
    const result: { month: string; label: string; balance: number }[] = []
    let balance = currentBalance
    for (let i = months.length - 1; i >= 0; i--) {
      const month = months[i]
      result.unshift({ month, label: format(parseISO(`${month}-01`), 'MMM'), balance: Math.round(balance) })
      balance -= (monthlyNet[month] ?? 0)
    }
    return result
  }, [transactions, currentBalance])

  const minBalance = Math.min(...data.map(d => d.balance))
  const maxBalance = Math.max(...data.map(d => d.balance))

  return (
    <div className="px-4 py-4">
      <h2 className="font-semibold mb-1">Balance trend</h2>
      <p className="text-2xl font-bold mb-4">{formatAmount(currentBalance, baseCurrency)}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis hide domain={[Math.min(minBalance * 0.95, 0), maxBalance * 1.05]} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
          <Tooltip
            formatter={(value: number) => [formatAmount(value, baseCurrency), 'Balance']}
            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-sm text-muted-foreground mt-2">Reconstructed from transactions · last 12 months</p>
    </div>
  )
}
