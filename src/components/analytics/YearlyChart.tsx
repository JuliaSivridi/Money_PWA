import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ReferenceLine,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useAccountsStore } from '@/store/accountsStore'
import { usePrefsStore } from '@/store/prefsStore'
import { useExchangeRateStore } from '@/store/exchangeRateStore'
import { AnalyticsAccountPicker } from './AnalyticsAccountPicker'
import { format, parseISO } from 'date-fns'
import { formatAmount, convertToBase } from '@/utils/currencyUtils'

interface Props {
  selectedMonth: string
  onMonthClick: (month: string) => void
}

type ShowState = { income: boolean; expenses: boolean; balance: boolean }

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
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [show, setShow] = useState<ShowState>({ income: true, expenses: true, balance: true })
  const [pickerOpen, setPickerOpen] = useState(false)

  const toggle = (key: keyof ShowState) => setShow(s => ({ ...s, [key]: !s[key] }))

  // All non-archived accounts, optionally filtered by user selection
  const balanceAccountIds = useMemo(() => {
    const pool = accounts.filter(a => !a.archived)
    return analyticsAccountIds.length > 0
      ? pool.filter(a => analyticsAccountIds.includes(a.id)).map(a => a.id)
      : pool.map(a => a.id)
  }, [accounts, analyticsAccountIds])

  // Convert each account balance to base currency before summing
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

  // Build rows for the selected year (only past/current months)
  const rows = useMemo(() => {
    const nowMonth = format(new Date(), 'yyyy-MM')
    const result: { month: string; label: string; income: number; negExpense: number }[] = []
    for (let i = 1; i <= 12; i++) {
      const month = `${year}-${String(i).padStart(2, '0')}`
      if (month > nowMonth) break
      const label = format(parseISO(`${month}-01`), 'MMM')
      const income = transactions
        .filter(t => t.type === 'income' && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount_base, 0)
      const expense = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount_base, 0)
      result.push({ month, label, income, negExpense: -expense })
    }
    return result
  }, [transactions, year])

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
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setYear(y => y - 1)} className="p-1 -ml-1 hover:text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-base">{year}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
            className="p-1 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            className={`p-1 -mr-1 transition-colors ${analyticsAccountIds.length > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Balance accounts"
          >
            <Settings2 size={16} />
          </button>
        </div>
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
