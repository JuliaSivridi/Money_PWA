import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthBarChart } from './MonthBarChart'
import { CategoryDonut } from './CategoryDonut'
import { IncomeExpenseChart } from './IncomeExpenseChart'
import { BalanceChart } from './BalanceChart'
import { useUIStore } from '@/store/uiStore'
import { formatMonthYear } from '@/utils/dateUtils'
import { format, addMonths, subMonths, parseISO } from 'date-fns'

type AnalyticsTab = 'spending' | 'income-expense' | 'balance'

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'spending',       label: 'Spending' },
  { id: 'income-expense', label: 'Income & Exp' },
  { id: 'balance',        label: 'Balance' },
]

export function AnalyticsPage() {
  const { analyticsMonth, setAnalyticsMonth } = useUIStore()
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('spending')

  const prevMonth = format(subMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')
  const nextMonth = format(addMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')
  const currentMonth = format(new Date(), 'yyyy-MM')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex shrink-0 px-3 py-2 border-b gap-1"
        style={{ background: 'var(--surface-2, hsl(var(--muted)/0.4))' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'spending' && (
          <>
            <div className="py-4">
              <MonthBarChart />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-b">
              <button onClick={() => setAnalyticsMonth(prevMonth)} className="p-1 hover:text-primary transition-colors">
                <ChevronLeft size={20} />
              </button>
              <p className="font-semibold">{formatMonthYear(analyticsMonth)}</p>
              <button
                onClick={() => setAnalyticsMonth(nextMonth)}
                disabled={nextMonth > currentMonth}
                className="p-1 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <CategoryDonut month={analyticsMonth} />
          </>
        )}
        {activeTab === 'income-expense' && <IncomeExpenseChart />}
        {activeTab === 'balance' && <BalanceChart />}
      </div>
    </div>
  )
}
