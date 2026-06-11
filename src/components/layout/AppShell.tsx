import { useEffect } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Header } from './Header'
import { Drawer } from './Drawer'
import { TransactionList } from '@/components/transactions/TransactionList'
import { AccountsPage } from '@/components/accounts/AccountsPage'
import { CategoriesPage } from '@/components/categories/CategoriesPage'
import { AnalyticsPage } from '@/components/analytics/AnalyticsPage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { HelpPage } from '@/components/help/HelpPage'
import { FeedbackPage } from '@/components/feedback/FeedbackPage'
import { useUIStore } from '@/store/uiStore'
import { useSync } from '@/hooks/useSync'
import { initialLoad, loadFromCache } from '@/services/syncService'
import { ensureSpreadsheet } from '@/api/spreadsheetSetup'
import { seedOnboarding } from '@/api/seedOnboarding'
import { usePrefsStore } from '@/store/prefsStore'
import { fetchExchangeRates } from '@/services/exchangeRateService'

export function AppShell() {
  const { selectedView, settingsOpen, helpOpen, feedbackOpen, sidebarOpen, setSidebarOpen } = useUIStore()
  useSync()

  useEffect(() => {
    const setup = async () => {
      await loadFromCache()   // instant UI from IndexedDB before any network work
      const prefs = usePrefsStore.getState()
      await fetchExchangeRates(prefs.baseCurrency)
      const { isNew } = await ensureSpreadsheet()
      if (isNew) await seedOnboarding()
      await initialLoad()
      await prefs.load()
    }
    void setup()
  }, [])

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!settingsOpen && !helpOpen && !feedbackOpen && (
          <>
            <aside className="hidden md:flex flex-col w-60 border-r flex-shrink-0 overflow-hidden">
              <Drawer />
            </aside>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetContent side="left" className="p-0 w-60 [&>button]:hidden">
                <Drawer />
              </SheetContent>
            </Sheet>
          </>
        )}

        <main className="flex-1 overflow-hidden">
          {helpOpen ? <HelpPage />
            : feedbackOpen ? <FeedbackPage />
            : settingsOpen ? <SettingsPage />
            : selectedView === 'transactions' ? <TransactionList />
            : selectedView === 'accounts' ? <AccountsPage />
            : selectedView === 'categories' ? <CategoriesPage />
            : <AnalyticsPage />}
        </main>
      </div>
    </div>
  )
}
