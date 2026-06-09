export type Rates = Record<string, number>

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function convertToBase(amount: number, currency: string, baseCurrency: string, rates: Rates): number {
  if (currency === baseCurrency) return amount
  const rate = rates[currency]
  if (!rate) return amount
  return amount / rate
}
