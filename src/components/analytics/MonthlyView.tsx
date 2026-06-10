import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { CategoryDonut } from './CategoryDonut'
import { DatePicker } from '@/components/common/DatePicker'
import { useUIStore } from '@/store/uiStore'
import { usePrefsStore } from '@/store/prefsStore'
import { useTransactionsStore } from '@/store/transactionsStore'
import { formatAmount } from '@/utils/currencyUtils'
import { formatMonthYear, currentMonthISO } from '@/utils/dateUtils'
import { format, addMonths, subMonths, parseISO, getDaysInMonth } from 'date-fns'

type TxType = 'expense' | 'income'
type PeriodMode = 'month' | '3months' | '6months' | 'year'

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getRange(mode: PeriodMode, analyticsMonth: string): { from: string; to: string } {
  const base = parseISO(`${analyticsMonth}-01`)
  const y = base.getFullYear(), mo = base.getMonth()
  if (mode === 'month') {
    return { from: localISO(new Date(y, mo, 1)), to: localISO(new Date(y, mo + 1, 0)) }
  }
  if (mode === '3months') {
    const start = subMonths(base, 2)
    return {
      from: localISO(new Date(start.getFullYear(), start.getMonth(), 1)),
      to: localISO(new Date(y, mo + 1, 0)),
    }
  }
  if (mode === '6months') {
    const start = subMonths(base, 5)
    return {
      from: localISO(new Date(start.getFullYear(), start.getMonth(), 1)),
      to: localISO(new Date(y, mo + 1, 0)),
    }
  }
  // year: rolling 12 months ending at end of analyticsMonth
  const start12 = subMonths(base, 11)
  return {
    from: localISO(new Date(start12.getFullYear(), start12.getMonth(), 1)),
    to: localISO(new Date(y, mo + 1, 0)),
  }
}

/** Format period duration for the donut center label, e.g. "avg /3M", "1Y", "5D" */
function periodLabel(from: string, to: string, isAverage: boolean): string {
  if (!from || !to) return ''
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1
  let abbr: string
  if (days <= 6)       abbr = `${days}D`
  else if (days <= 27) abbr = `${Math.round(days / 7)}W`
  else if (days < 360) abbr = `${Math.round(days / 30)}M`
  else                 abbr = `${Math.round(days / 365)}Y`
  return isAverage ? `avg /${abbr}` : abbr
}

const CHIPS: { mode: PeriodMode; label: string }[] = [
  { mode: 'month',   label: 'Month' },
  { mode: '3months', label: '3M' },
  { mode: '6months', label: '6M' },
  { mode: 'year',    label: 'Year' },
]

export function MonthlyView() {
  const { analyticsMonth, setAnalyticsMonth } = useUIStore()
  const { baseCurrency } = usePrefsStore()
  const { transactions } = useTransactionsStore()

  const [txType, setTxType] = useState<TxType>('expense')
  const [mode, setMode]     = useState<PeriodMode>('month')

  const initRange = getRange('month', analyticsMonth)
  const [dateFrom, setDateFrom] = useState(initRange.from)
  const [dateTo,   setDateTo]   = useState(initRange.to)

  const currentMonthStr = format(new Date(), 'yyyy-MM')

  // Keep dates in sync when chip or analyticsMonth changes
  useEffect(() => {
    const r = getRange(mode, analyticsMonth)
    setDateFrom(r.from)
    setDateTo(r.to)
  }, [mode, analyticsMonth])

  // When user edits dates manually, deactivate chips
  const [customMode, setCustomMode] = useState(false)
  const handleDateFrom = (v: string) => { setDateFrom(v); setCustomMode(true) }
  const handleDateTo   = (v: string) => { setDateTo(v);   setCustomMode(true) }
  const selectChip = (m: PeriodMode) => {
    // Anchor to the end of the current date range so chips always work
    // backwards from dateTo, regardless of analyticsMonth state timing.
    const anchor = dateTo.slice(0, 7) || analyticsMonth
    setAnalyticsMonth(anchor)
    const r = getRange(m, anchor)
    setDateFrom(r.from)
    setDateTo(r.to)
    setMode(m)
    setCustomMode(false)
  }

  // Count months in period
  const monthCount = useMemo(() => {
    if (!dateFrom || !dateTo) return 1
    const [fy, fm] = dateFrom.split('-').map(Number)
    const [ty, tm] = dateTo.split('-').map(Number)
    return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1)
  }, [dateFrom, dateTo])

  const isAverage = monthCount > 1

  // Both totals for the period
  const totals = useMemo(() => {
    const result = { expense: 0, income: 0 }
    for (const t of transactions) {
      if (t.type !== 'expense' && t.type !== 'income') continue
      if (dateFrom && t.date < dateFrom) continue
      if (dateTo && t.date > dateTo) continue
      result[t.type] += t.amount_base
    }
    return result
  }, [transactions, dateFrom, dateTo])

  const displayExpense = isAverage ? totals.expense / monthCount : totals.expense
  const displayIncome  = isAverage ? totals.income  / monthCount : totals.income

  // Today marker: only single-month view of the current month
  const today = new Date()
  const isCurrentMonth = analyticsMonth === currentMonthStr
  const todayFraction = (!customMode && mode === 'month' && isCurrentMonth)
    ? today.getDate() / getDaysInMonth(today)
    : undefined

  const prevMonth = format(subMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')
  const nextMonth = format(addMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')

  const donutLabel = periodLabel(dateFrom, dateTo, isAverage)

  // Show reset when the current dates differ from "today's month"
  const defaultRange = getRange('month', currentMonthStr)
  const isDefaultPeriod = dateFrom === defaultRange.from && dateTo === defaultRange.to

  const resetToNow = () => {
    setAnalyticsMonth(currentMonthISO())
    const r = getRange('month', currentMonthStr)
    setDateFrom(r.from)
    setDateTo(r.to)
    setMode('month')
    setCustomMode(false)
  }

  return (
    <div className="pb-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={() => setAnalyticsMonth(prevMonth)} className="p-1 hover:text-primary transition-colors">
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

      {/* Always-visible date range + reset */}
      <div className="flex gap-2 px-4 pt-3 pb-2 items-center">
        <DatePicker value={dateFrom} onChange={handleDateFrom} />
        <DatePicker value={dateTo}   onChange={handleDateTo} />
        {!isDefaultPeriod && (
          <button
            onClick={resetToNow}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
            title="Back to current month"
          >
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      {/* Period chips */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
        {CHIPS.map(({ mode: m, label }) => (
          <button
            key={m}
            onClick={() => selectChip(m)}
            className={`px-3 py-1 rounded-full border text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              !customMode && mode === m
                ? 'bg-primary/15 text-primary border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Full-width Expenses / Income toggle with totals — single line */}
      <div className="flex border-t border-b">
        {(['expense', 'income'] as const).map(t => {
          const amount = t === 'expense' ? displayExpense : displayIncome
          const active = txType === t
          return (
            <button
              key={t}
              onClick={() => setTxType(t)}
              className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                active ? 'border-primary' : 'border-transparent'
              }`}
            >
              <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {t === 'expense' ? 'Expenses' : 'Income'}
              </span>
              <span className={`text-sm font-bold ${
                t === 'income'
                  ? 'text-green-500'
                  : active ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                {formatAmount(amount, baseCurrency)}{isAverage && '/mo'}
              </span>
            </button>
          )
        })}
      </div>

      <CategoryDonut
        type={txType}
        dateFrom={dateFrom}
        dateTo={dateTo}
        isAverage={isAverage}
        monthCount={monthCount}
        todayFraction={todayFraction}
        periodLabel={donutLabel}
      />
    </div>
  )
}
