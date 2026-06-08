import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { usePrefsStore } from '@/store/prefsStore'
import { listUserSheets } from '@/api/driveApi'
import { initialLoad } from '@/services/syncService'
import { fetchExchangeRates } from '@/services/exchangeRateService'
import { db } from '@/services/db'
import { invalidateRowCache } from '@/api/sheetsClient'

const CURRENCIES = ['EUR', 'USD', 'RUB']

export function SettingsPage() {
  const { spreadsheetId, spreadsheetName, setSpreadsheet } = useAuthStore()
  const { baseCurrency, setBaseCurrency, save } = usePrefsStore()
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([])
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [changingSheet, setChangingSheet] = useState(false)
  const [savingCurrency, setSavingCurrency] = useState(false)

  const loadSheets = async () => {
    setLoadingSheets(true)
    try {
      const result = await listUserSheets()
      setSheets(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSheets(false)
    }
  }

  const handleChangeSheet = async (id: string, name: string) => {
    if (id === spreadsheetId) { setSheets([]); return }
    setChangingSheet(true)
    try {
      await Promise.all([
        db.transactions.clear(), db.accounts.clear(),
        db.categories.clear(), db.queue.clear(),
      ])
      invalidateRowCache()
      setSpreadsheet(id, name)
      await initialLoad()
    } finally {
      setChangingSheet(false)
      setSheets([])
    }
  }

  const handleCurrencyChange = async (currency: string) => {
    setBaseCurrency(currency)
    setSavingCurrency(true)
    try {
      await save()
      await fetchExchangeRates(currency)
    } finally {
      setSavingCurrency(false)
    }
  }

  const showingList = sheets.length > 0

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Spreadsheet card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold">Spreadsheet</h3>
            <p className="text-sm text-foreground truncate">{spreadsheetName || 'db_money'}</p>
          </div>
          {!showingList ? (
            <Button size="sm" variant="outline" onClick={() => void loadSheets()} disabled={loadingSheets} className="shrink-0">
              {loadingSheets ? 'Loading…' : 'Change'}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setSheets([])} className="shrink-0">
              Cancel
            </Button>
          )}
        </div>

        {showingList && (
          <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
            {sheets.map(s => (
              <button
                key={s.id}
                onClick={() => void handleChangeSheet(s.id, s.name)}
                disabled={changingSheet}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 ${s.id === spreadsheetId ? 'bg-accent/50' : ''}`}
              >
                <span className="truncate">{s.name}</span>
                {s.id === spreadsheetId && <span className="text-primary text-xs shrink-0">current</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Base currency card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Base currency</h3>
        <p className="text-sm text-muted-foreground">Used for analytics and balance totals.</p>
        <Select value={baseCurrency} onValueChange={(v) => void handleCurrencyChange(v)} disabled={savingCurrency}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {savingCurrency && <p className="text-xs text-muted-foreground">Updating exchange rates…</p>}
      </div>
    </div>
  )
}
