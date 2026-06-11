import { useEffect, useState } from 'react'
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
import { checkSpreadsheet, createSpreadsheet } from '@/api/spreadsheetSetup'
import { seedOnboarding } from '@/api/seedOnboarding'
import { usePrefsStore } from '@/store/prefsStore'
import { fetchExchangeRates } from '@/services/exchangeRateService'
import { openSpreadsheetPicker } from '@/services/picker'
import { useAuthStore } from '@/store/authStore'

/** First-run / migration screen: never create a file silently — the user
 *  explicitly creates a new spreadsheet or picks an existing one. */
function SetupScreen({ onDone }: { onDone: () => void }) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setBusy(true); setError('')
    try {
      await createSpreadsheet()
      await seedOnboarding()
      onDone()
    } catch (e) { setError(String(e)) }
    finally { setBusy(false) }
  }

  async function handlePick() {
    setError('')
    try {
      const file = await openSpreadsheetPicker()
      if (file) {
        useAuthStore.getState().setSpreadsheet(file.id, file.name)
        onDone()
      }
    } catch (e) { setError(String(e)) }
  }

  return (
    <div className="flex flex-col items-center justify-center h-dvh gap-3 bg-background text-foreground px-6 text-center">
      <h2 className="text-lg font-semibold">Choose your data file</h2>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        Money stores your finances in a Google Sheets file in your Drive.
        Create a new one, or pick an existing spreadsheet (e.g. your db_money).
      </p>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        <button
          onClick={() => void handlePick()}
          disabled={busy}
          className="px-4 py-2.5 rounded-[10px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          Choose from Google Drive
        </button>
        <button
          onClick={() => void handleCreate()}
          disabled={busy}
          className="px-4 py-2.5 rounded-[10px] border border-border text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create new spreadsheet'}
        </button>
      </div>
      {error && <p className="text-sm text-destructive max-w-sm">{error}</p>}
    </div>
  )
}

export function AppShell() {
  const { selectedView, settingsOpen, helpOpen, feedbackOpen, sidebarOpen, setSidebarOpen } = useUIStore()
  const [needsSetup, setNeedsSetup] = useState(false)
  useSync()

  const continueSetup = async () => {
    await initialLoad()
    await usePrefsStore.getState().load()
  }

  useEffect(() => {
    const setup = async () => {
      await loadFromCache()   // instant UI from IndexedDB before any network work
      await fetchExchangeRates(usePrefsStore.getState().baseCurrency)
      if (await checkSpreadsheet() === 'setup') { setNeedsSetup(true); return }
      await continueSetup()
    }
    void setup()
  }, [])

  if (needsSetup) {
    return <SetupScreen onDone={() => { setNeedsSetup(false); void continueSetup() }} />
  }

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
