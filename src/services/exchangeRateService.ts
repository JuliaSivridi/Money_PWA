import { useExchangeRateStore } from '@/store/exchangeRateStore'
import { loadSettings, saveSettings } from '@/api/settingsApi'
import type { Rates } from '@/utils/currencyUtils'

export async function fetchExchangeRates(baseCurrency: string): Promise<void> {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`)
    if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`)
    const data = await res.json() as { rates: Rates }
    const rates = { ...data.rates, [baseCurrency]: 1 }
    useExchangeRateStore.getState().setRates(baseCurrency, rates)
    // Cache to settings sheet (best-effort)
    try {
      const settings = await loadSettings()
      await saveSettings({ ...settings, base_currency: baseCurrency, exchange_rates: rates })
    } catch { /* non-critical */ }
  } catch (err) {
    console.warn('Exchange rate fetch failed, using cached rates', err)
    // Fall back to settings sheet cached rates
    try {
      const settings = await loadSettings()
      if (settings.exchange_rates) {
        useExchangeRateStore.getState().setRates(
          settings.base_currency ?? baseCurrency,
          settings.exchange_rates,
        )
      }
    } catch { /* nothing we can do */ }
  }
}
