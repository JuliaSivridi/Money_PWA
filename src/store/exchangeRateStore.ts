import { create } from 'zustand'
import type { Rates } from '@/utils/currencyUtils'

interface ExchangeRateState {
  rates: Rates
  baseCurrency: string
  setRates: (baseCurrency: string, rates: Rates) => void
  getRate: (currency: string) => number
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  rates: {},
  baseCurrency: 'EUR',

  setRates: (baseCurrency, rates) => set({ baseCurrency, rates }),

  getRate: (currency) => {
    const { rates, baseCurrency } = get()
    if (currency === baseCurrency) return 1
    return rates[currency] ?? 1
  },
}))
