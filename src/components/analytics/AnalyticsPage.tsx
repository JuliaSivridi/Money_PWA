import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthBarChart } from './MonthBarChart'
import { CategoryDonut } from './CategoryDonut'
import { useUIStore } from '@/store/uiStore'
import { formatMonthYear } from '@/utils/dateUtils'
import { format, addMonths, subMonths, parseISO } from 'date-fns'

export function AnalyticsPage() {
  const { analyticsMonth, setAnalyticsMonth } = useUIStore()

  const prevMonth = format(subMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')
  const nextMonth = format(addMonths(parseISO(`${analyticsMonth}-01`), 1), 'yyyy-MM')
  const currentMonth = format(new Date(), 'yyyy-MM')

  return (
    <div className="h-full overflow-y-auto">
      <div className="py-4">
        <MonthBarChart />
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-b">
        <button onClick={() => setAnalyticsMonth(prevMonth)} className="p-1 hover:text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="font-semibold">{formatMonthYear(analyticsMonth)}</p>
        </div>
        <button
          onClick={() => setAnalyticsMonth(nextMonth)}
          disabled={nextMonth > currentMonth}
          className="p-1 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <CategoryDonut month={analyticsMonth} />
    </div>
  )
}
