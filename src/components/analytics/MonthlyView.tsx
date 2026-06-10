import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryDonut } from './CategoryDonut'
import { useUIStore } from '@/store/uiStore'
import { usePrefsStore } from '@/store/prefsStore'
import { useTransactionsStore } from '@/store/transactionsStore'
import { formatAmount } from '@/utils/currencyUtils'
import { formatMonthYear } from '@/utils/dateUtils'
import { format, addMonths, subMonths, parseISO, getDaysInMonth } from 'date-fns'

type TxType = 'expense' | 'income'
type PeriodMode = 'month' | '3months' | 'year' | 'custom'

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PERIOD_LABELS: Record<PeriodMode, string> = {
  month:   'Month',
  '3months': '3 months',
  year:    'Year',
  custom:  'Custom',
}

export function MonthlyView() {
  const { analyticsMonth, setAnalyticsMonth } = useUIStore()
  const { baseCurrency } = usePrefsStore()
  const { transactions } = useTransactionsStore()

  const [txType, setTxType]     = useState<TxType>('expense')
  const [mode, setMode]         = useState<PeriodMode>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const currentMonthStr = format(new Date(), 'yyyy-MM')

  // Compute date range from mode + analyticsMonth
  const { dateFrom, dateTo } = useMemo(() => {
    const base = parseISO(`${analyticsMonth}-01`)
    if (mode === 'month') {
      const y = base.getFullYear(), mo = base.getMonth()
      return {
        dateFrom: localISO(new Date(y, mo, 1)),
        dateTo:   localISO(new Date(y, mo + 1, 0)),
      }
    }
    if (mode === '3months') {
      const start = subMonths(base, 2)
      const y = base.getFullYear(), mo = base.getMonth()
      return {
        dateFrom: localISO(new Date(start.getFullYear(), start.getMonth(), 1)),
        dateTo:   localISO(new Date(y, mo + 1, 0)),
      }
    }
    if (mode === 'year') {
      const y = base.getFullYear()
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` }
    }
    return { dateFrom: customFrom, dateTo: customTo }
  }, [analyticsMonth, mode, customFrom, customTo])

  // Count distinct months in period for average display
  const monthCount = useMemo(() => {
    if (!dateFrom || !dateTo) return 1
    const [fy, fm] = dateFrom.split('-').map(Number)
    const [ty, tm] = dateTo.split('-').map(Number)
    return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1)
  }, [dateFrom, dateTo])

  const isAverage = monthCount > 1

  // Total for the period
  const total = useMemo(() =>
    transactions
      .filter(t => {
        if (t.type !== txType) return false
        if (dateFrom && t.date < dateFrom) return false
        if (dateTo && t.date > dateTo) return false
        return true
      })
      .reduce((s, t) => s + t.amount_base, 0),
    [transactions, txType, dateFrom, dateTo],
  )

  const displayTotal = isAverage ? total / monthCount : total

  // "Today" fraction: only for single-month view showing the current month
  const today = new Date()
  const isCurrentMonth = analyticsMonth === currentMonthStr
  const todayFraction = (mode === 'month' && isCurrentMonth)
    ? today.getDate() / getDaysInMonth(today)
    : undefined

  // Month navigation
  const prevMonth = format(subMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')
  const nextMonth = format(addMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')

  return (
    <div className="pb-6">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button
          onClick={() => setAnalyticsMonth(prevMonth)}
          className="p-1 hover:text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="font-semibold">{formatMonthYear(analyticsMonth)}</p>
        <button
          onClick={() => setAnalyticsMonth(nextMonth)}
          disabled={nextMonth > currentMonthStr}
          className="p-1 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Type toggle + total */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-2 mb-2">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTxType(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                txType === t
                  ? t === 'expense'
                    ? 'bg-red-500/15 text-red-500 border-red-500/40'
                    : 'bg-green-500/15 text-green-600 border-green-500/40'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'expense' ? 'Expenses' : 'Income'}
            </button>
          ))}
        </div>
        <p className="text-2xl font-bold leading-tight">
          {formatAmount(displayTotal, baseCurrency)}
          {isAverage && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              /mo avg · {monthCount} months
            </span>
          )}
        </p>
      </div>

      {/* Period mode chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
        {(Object.keys(PERIOD_LABELS) as PeriodMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              mode === m
                ? 'bg-primary/15 text-primary border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {PERIOD_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {mode === 'custom' && (
        <div className="flex gap-2 px-4 pb-3">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      <CategoryDonut
        type={txType}
        dateFrom={dateFrom}
        dateTo={dateTo}
        isAverage={isAverage}
        monthCount={monthCount}
        todayFraction={todayFraction}
      />
    </div>
  )
}
