import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useCategoriesStore } from '@/store/categoriesStore'
import { usePrefsStore } from '@/store/prefsStore'
import { formatAmount } from '@/utils/currencyUtils'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { BarChart2 } from 'lucide-react'

interface Props {
  type: 'expense' | 'income'
  dateFrom: string
  dateTo: string
  isAverage?: boolean
  monthCount?: number
  /** 0–1 fraction of current month elapsed; when set, shows a "today" marker on progress bars */
  todayFraction?: number
  /** Short period label shown inside the donut, e.g. "avg /3M" or "1M" */
  periodLabel?: string
}

const RADIAN = Math.PI / 180

export function CategoryDonut({ type, dateFrom, dateTo, isAverage = false, monthCount = 1, todayFraction, periodLabel }: Props) {
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = usePrefsStore()

  const { data, total } = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (t.type !== type) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      return true
    })
    const byCategory = new Map<string, number>()
    for (const t of filtered) {
      const primaryId = t.category_ids[0]
      if (primaryId) byCategory.set(primaryId, (byCategory.get(primaryId) ?? 0) + t.amount_base)
    }
    const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0)
    const data = categories
      .filter(c => byCategory.has(c.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        amount: byCategory.get(c.id)!,
        limit: type === 'expense' ? (c.expense_limit ?? 0) : 0,
      }))
    return { data, total }
  }, [transactions, categories, type, dateFrom, dateTo])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <BarChart2 size={40} className="opacity-20" />
        <p>No data for this period</p>
      </div>
    )
  }

  const displayTotal = isAverage ? total / monthCount : total

  const renderPieLabel = (props: { cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; index: number }) => {
    if (props.percent <= 0.03) return null
    const r = props.outerRadius + 26
    const x = props.cx + r * Math.cos(-props.midAngle * RADIAN)
    const y = props.cy + r * Math.sin(-props.midAngle * RADIAN)
    const item = data[props.index]
    const sz = 26
    return (
      <foreignObject key={`lbl-${item.id}`} x={x - sz / 2} y={y - sz / 2} width={sz} height={sz}>
        <CategoryIcon icon={item.icon} color={item.color} size={14} />
      </foreignObject>
    )
  }

  return (
    <div>
      <div className="relative pt-8">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              label={renderPieLabel}
              labelLine={false}
            >
              {data.map(entry => <Cell key={entry.id} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-lg font-bold">{formatAmount(displayTotal, baseCurrency)}</span>
          {periodLabel ? (
            <span className="text-xs text-muted-foreground font-medium">{periodLabel}</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {type === 'expense' ? 'expenses' : 'income'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-2 px-4">
        {data.map(item => {
          const displayAmount = isAverage ? item.amount / monthCount : item.amount
          const pct = item.limit > 0 ? Math.min(displayAmount / item.limit, 1) : 0
          const exceeded = item.limit > 0 && displayAmount > item.limit
          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <CategoryIcon icon={item.icon} color={item.color} size={14} />
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-sm font-medium">{formatAmount(displayAmount, baseCurrency)}</span>
                {item.limit > 0 && (
                  <span className={`text-sm ${exceeded ? 'text-red-400' : 'text-green-400'}`}>
                    {exceeded ? '✗' : '✓'} {formatAmount(item.limit, baseCurrency)}
                  </span>
                )}
              </div>
              {item.limit > 0 && (
                <div className="relative h-1.5 bg-muted rounded-full">
                  <div
                    className={`h-full rounded-full ${exceeded ? 'bg-red-400' : 'bg-green-400'}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                  {todayFraction !== undefined && (
                    <div
                      className="absolute -top-2 bottom-0 w-0.5 bg-foreground/60 rounded-full"
                      style={{ left: `${todayFraction * 100}%` }}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
