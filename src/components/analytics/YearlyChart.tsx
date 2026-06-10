import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ReferenceLine,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChevronLeft, ChevronRight, Settings2, RotateCcw } from 'lucide-react'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useAccountsStore } from '@/store/accountsStore'
import { usePrefsStore } from '@/store/prefsStore'
import { useExchangeRateStore } from '@/store/exchangeRateStore'
import { AnalyticsAccountPicker } from './AnalyticsAccountPicker'
import { format, parseISO, subYears, startOfYear } from 'date-fns'
import { formatAmount, convertToBase } from '@/utils/currencyUtils'

interface Props {
  selectedMonth: string
  onMonthClick: (month: string) => void
}

type ShowState = { income: boolean; expenses: boolean; balance: boolean }
type YearPeriod = 'this-year' | '1y' | '3y' | 'custom'

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const YEAR_CHIPS: { id: YearPeriod; label: string }[] = [
  { id: 'this-year', label: 'This year' },
  { id: '1y',        label: '1Y' },
  { id: '3y',        label: '3Y' },
]

function chipRange(chip: YearPeriod, today: Date): { from: string; to: string } {
  if (chip === 'this-year') return { from: localISO(startOfYear(today)), to: localISO(today) }
  if (chip === '1y') return { from: localISO(subYears(today, 1)), to: localISO(today) }
  return { from: localISO(subYears(today, 3)), to: localISO(today) }
}

const INCOME_COLOR  = 'hsl(142 71% 45%)'
const EXPENSE_COLOR = 'hsl(0 72% 51%)'

interface TooltipEntry {
  month: string
  label: string
  income: number
  negExpense: number
  balance: number | null
}

function ChartTooltip({
  active, payload, label, show, baseCurrency,
}: {
  active?: boolean
  payload?: { payload: TooltipEntry }[]
  label?: string
  show: ShowState
  baseCurrency: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const net = d.income + d.negExpense
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md space-y-1 min-w-[160px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {show.income && (
        <p style={{ color: INCOME_COLOR }}>Income: {formatAmount(d.income, baseCurrency)}</p>
      )}
      {show.expenses && (
        <p style={{ color: EXPENSE_COLOR }}>Expenses: {formatAmount(Math.abs(d.negExpense), baseCurrency)}</p>
      )}
      {show.income && show.expenses && (
        <p className={`border-t pt-1 ${net >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          Net: {net >= 0 ? '+' : ''}{formatAmount(net, baseCurrency)}
        </p>
      )}
      {show.balance && d.balance !== null && (
        <p className="text-primary">Balance: {formatAmount(d.balance, baseCurrency)}</p>
      )}
    </div>
  )
}

function SeriesToggle({
  active, color, label, onClick,
}: {
  active: boolean; color: string; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-sm transition-opacity ${active ? '' : 'opacity-35'}`}
    >
      <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
      {label}
    </button>
  )
}

export function YearlyChart({ selectedMonth, onMonthClick }: Props) {
  const { transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency, analyticsAccountIds } = usePrefsStore()
  const { rates } = useExchangeRateStore()
  const today = new Date()
  const currentYear = today.getFullYear()
  const [year, setYear] = useState(currentYear)
  const [show, setShow] = useState<ShowState>({ income: true, expenses: true, balance: true })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [periodChip, setPeriodChip] = useState<YearPeriod>('this-year')

  const toggle = (key: keyof ShowState) => setShow(s => ({ ...s, [key]: !s[key] }))

  const selectChip = (chip: YearPeriod) => {
    setPeriodChip(chip)
    if (chip !== 'custom') {
      const r = chipRange(chip, today)
      setYear(today.getFullYear())
      // store from/to for filtering
      setChipFrom(r.from)
      setChipTo(r.to)
    }
  }

  const [chipFrom, setChipFrom] = useState(() => chipRange('this-year', today).from)
  const [chipTo,   setChipTo]   = useState(() => chipRange('this-year', today).to)

  const resetToNow = () => {
    setPeriodChip('this-year')
    setYear(currentYear)
    const r = chipRange('this-year', today)
    setChipFrom(r.from)
    setChipTo(r.to)
  }

  // Only include accounts whose currency we can convert (base currency, or rate exists).
  // Without this guard, a ₽6,000,000 account with no rate would be treated as €6,000,000.
  const balanceAccountIds = useMemo(() => {
    const pool = accounts.filter(a =>
      !a.archived && (a.currency === baseCurrency || Boolean(rates[a.currency]))
    )
    const eligible = analyticsAccountIds.length > 0
      ? pool.filter(a => analyticsAccountIds.includes(a.id))
      : pool
    return eligible.map(a => a.id)
  }, [accounts, analyticsAccountIds, baseCurrency, rates])

  const currentBalance = useMemo(
    () => accounts
      .filter(a => balanceAccountIds.includes(a.id))
      .reduce((s, a) => s + convertToBase(a.balance, a.currency, baseCurrency, rates), 0),
    [accounts, balanceAccountIds, baseCurrency, rates],
  )

  // Monthly net filtered to the same accounts as currentBalance
  const monthlyNet = useMemo(() => {
    const net: Record<string, number> = {}
    for (const t of transactions) {
      if (t.type !== 'income' && t.type !== 'expense') continue
      if (!balanceAccountIds.includes(t.account_id)) continue
      const m = t.date.slice(0, 7)
      net[m] = (net[m] ?? 0) + (t.type === 'income' ? t.amount_base : -t.amount_base)
    }
    return net
  }, [transactions, balanceAccountIds])

  // Build rows for the selected range
  const rows = useMemo(() => {
    const nowMonth = format(new Date(), 'yyyy-MM')
    const from = periodChip === 'custom' ? `${year}-01` : chipFrom.slice(0, 7)
    const to   = periodChip === 'custom' ? `${year}-12` : chipTo.slice(0, 7)
    const multiYear = from.slice(0, 4) !== to.slice(0, 4)
    const result: { month: string; label: string; income: number; negExpense: number }[] = []
    let cur = from
    while (cur <= to && cur <= nowMonth) {
      const label = multiYear
        ? format(parseISO(`${cur}-01`), "MMM ''yy")
        : format(parseISO(`${cur}-01`), 'MMM')
      const income = transactions
        .filter(t => t.type === 'income' && t.date.startsWith(cur))
        .reduce((s, t) => s + t.amount_base, 0)
      const expense = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(cur))
        .reduce((s, t) => s + t.amount_base, 0)
      result.push({ month: cur, label, income, negExpense: -expense })
      const [y, m] = cur.split('-').map(Number)
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    }
    return result
  }, [transactions, year, periodChip, chipFrom, chipTo])

  // Reconstruct end-of-month balances by walking backwards from currentBalance
  const data = useMemo((): TooltipEntry[] => {
    if (rows.length === 0) return []
    const nowMonth = format(new Date(), 'yyyy-MM')
    const earliest = rows[0].month
    const balAt: Record<string, number> = {}
    let bal = currentBalance
    let cur = nowMonth
    while (cur >= earliest) {
      balAt[cur] = Math.round(bal)
      bal -= (monthlyNet[cur] ?? 0)
      const [y, m] = cur.split('-').map(Number)
      cur = m === 1
        ? `${y - 1}-12`
        : `${y}-${String(m - 1).padStart(2, '0')}`
    }
    return rows.map(r => ({ ...r, balance: balAt[r.month] ?? null }))
  }, [rows, currentBalance, monthlyNet])

  // Y-axis domain: must contain bars (positive income, negative expense) and balance line
  const maxBar = Math.max(...data.map(d => Math.max(d.income, Math.abs(d.negExpense))), 1)
  const maxBal = data.reduce((m, d) => Math.max(m, d.balance ?? 0), 0)
  const minBal = data.reduce((m, d) => Math.min(m, d.balance ?? 0), 0)
  const yMax = Math.max(maxBar * 1.15, maxBal * 1.05)
  const yMin = Math.min(-maxBar * 1.15, minBal > 0 ? 0 : minBal * 0.95)

  const handleClick = (e: { activePayload?: { payload: TooltipEntry }[] } | null) => {
    if (e?.activePayload?.[0]) onMonthClick(e.activePayload[0].payload.month)
  }

  return (
    <div className="px-4 py-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => { setYear(y => y - 1); setPeriodChip('custom') }}
          className="p-1 -ml-1 hover:text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className={`font-semibold text-base ${periodChip !== 'custom' ? 'text-muted-foreground' : ''}`}>{year}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setYear(y => y + 1); setPeriodChip('custom') }}
            disabled={year >= currentYear && periodChip === 'custom'}
            className="p-1 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
          {periodChip !== 'this-year' && (
            <button
              onClick={resetToNow}
              className="p-1 text-muted-foreground hover:text-primary transition-colors"
              title="Back to current period"
            >
              <RotateCcw size={15} />
            </button>
          )}
          <button
            onClick={() => setPickerOpen(true)}
            className={`p-1 -mr-1 transition-colors ${analyticsAccountIds.length > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Balance accounts"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Period chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none">
        {YEAR_CHIPS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => selectChip(id)}
            className={`px-3 py-1 rounded-full border text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              periodChip === id
                ? 'bg-primary/15 text-primary border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Series toggles */}
      <div className="flex gap-5 mb-3">
        <SeriesToggle active={show.income}   color={INCOME_COLOR}            label="Income"   onClick={() => toggle('income')} />
        <SeriesToggle active={show.expenses} color={EXPENSE_COLOR}           label="Expenses" onClick={() => toggle('expenses')} />
        <SeriesToggle active={show.balance}  color="hsl(var(--primary))"     label="Balance"  onClick={() => toggle('balance')} />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} barCategoryGap="30%" onClick={handleClick}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis hide domain={[yMin, yMax]} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload as { payload: TooltipEntry }[] | undefined}
                label={props.label as string | undefined}
                show={show}
                baseCurrency={baseCurrency}
              />
            )}
          />
          {show.income && (
            <Bar dataKey="income" radius={[3, 3, 0, 0]} cursor="pointer" maxBarSize={20}>
              {data.map(d => (
                <Cell
                  key={d.month}
                  fill={INCOME_COLOR}
                  fillOpacity={d.month === selectedMonth ? 1 : 0.6}
                />
              ))}
            </Bar>
          )}
          {show.expenses && (
            <Bar dataKey="negExpense" radius={[0, 0, 3, 3]} cursor="pointer" maxBarSize={20}>
              {data.map(d => (
                <Cell
                  key={d.month}
                  fill={EXPENSE_COLOR}
                  fillOpacity={d.month === selectedMonth ? 1 : 0.6}
                />
              ))}
            </Bar>
          )}
          {show.balance && (
            <Line
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground mt-1 text-center">
        Tap a month to view details · Balance in {baseCurrency}
        {analyticsAccountIds.length > 0 && ` · ${analyticsAccountIds.length} account${analyticsAccountIds.length > 1 ? 's' : ''}`}
      </p>

      <AnalyticsAccountPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  )
}
