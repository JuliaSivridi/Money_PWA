import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { usePrefsStore } from '@/store/prefsStore'
import { openSpreadsheetPicker } from '@/services/picker'
import { initialLoad } from '@/services/syncService'
import { fetchExchangeRates } from '@/services/exchangeRateService'
import { db } from '@/services/db'
import { invalidateRowCache } from '@/api/sheetsClient'

const CURRENCIES = ['EUR', 'USD', 'RUB']

export function SettingsPage() {
  const { spreadsheetId, spreadsheetName, setSpreadsheet } = useAuthStore()
  const { baseCurrency, setBaseCurrency, save } = usePrefsStore()
  const [changingSheet, setChangingSheet] = useState(false)
  const [savingCurrency, setSavingCurrency] = useState(false)

  // Native Google Picker: picking a file also grants the app access to it
  // (we only have the drive.file scope — the rest of Drive is invisible).
  const handleOpenPicker = async () => {
    setChangingSheet(true)
    try {
      const file = await openSpreadsheetPicker()
      if (!file || file.id === spreadsheetId) return
      await Promise.all([
        db.transactions.clear(), db.accounts.clear(),
        db.categories.clear(), db.queue.clear(),
      ])
      invalidateRowCache()
      setSpreadsheet(file.id, file.name)
      await initialLoad()
    } catch (err) {
      console.error(err)
    } finally {
      setChangingSheet(false)
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

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Spreadsheet card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold">Spreadsheet</h3>
            <p className="text-sm text-foreground truncate">{spreadsheetName || 'db_money'}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void handleOpenPicker()} disabled={changingSheet} className="shrink-0">
            {changingSheet ? 'Loading…' : 'Change'}
          </Button>
        </div>
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
        {savingCurrency && <p className="text-sm text-muted-foreground">Updating exchange rates…</p>}
      </div>
    </div>
  )
}
