import { useState } from 'react'
import { YearlyChart } from './YearlyChart'
import { MonthlyView } from './MonthlyView'
import { useUIStore } from '@/store/uiStore'

type AnalyticsTab = 'yearly' | 'monthly'

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'yearly',  label: 'Yearly' },
  { id: 'monthly', label: 'Monthly' },
]

export function AnalyticsPage() {
  const { analyticsMonth, setAnalyticsMonth } = useUIStore()
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('yearly')

  const handleMonthClick = (month: string) => {
    setAnalyticsMonth(month)
    setActiveTab('monthly')
  }

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
        {activeTab === 'yearly' && (
          <YearlyChart
            selectedMonth={analyticsMonth}
            onMonthClick={handleMonthClick}
          />
        )}
        {activeTab === 'monthly' && <MonthlyView />}
      </div>
    </div>
  )
}
