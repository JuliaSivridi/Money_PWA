import { useExchangeRateStore } from '@/store/exchangeRateStore'
import { loadSettings, saveSettings } from '@/api/settingsApi'
import type { Rates } from '@/utils/currencyUtils'

// fawazahmed0/currency-api: free, no key, CDN-served, includes RUB, updated daily.
// Returns { date, [baseLower]: { usd: 1.08, rub: 98.5, ... } }
export async function fetchExchangeRates(baseCurrency: string): Promise<void> {
  try {
    const base = baseCurrency.toLowerCase()
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`
    )
    if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`)
    const data = await res.json() as Record<string, Record<string, number>>
    const rawRates = data[base]
    if (!rawRates) throw new Error('Unexpected response format')
    // Normalise keys to uppercase to match our currency codes (EUR, USD, RUB…)
    const rates: Rates = { [baseCurrency]: 1 }
    for (const [k, v] of Object.entries(rawRates)) {
      rates[k.toUpperCase()] = v
    }
    useExchangeRateStore.getState().setRates(baseCurrency, rates)
    // Cache to settings sheet (best-effort)
    try {
      const settings = await loadSettings()
      await saveSettings({ ...settings, base_currency: baseCurrency, exchange_rates: rates })
    } catch { /* non-critical */ }
  } catch (err) {
    // Store already has last-known rates from localStorage persist — no extra fallback needed
    console.warn('Exchange rate fetch failed, using cached rates', err)
  }
}
