import { sheetsRequest } from './sheetsClient'
import type { SheetsGetResponse } from '@/types/sheets'

export interface Settings {
  base_currency?: string
  exchange_rates?: Record<string, number>
  analytics_account_ids?: string[]
}

export async function loadSettings(): Promise<Settings> {
  try {
    const data = await sheetsRequest<SheetsGetResponse>('GET', 'values/settings!A1')
    const raw = data.values?.[0]?.[0]
    if (!raw) return {}
    return JSON.parse(raw) as Settings
  } catch {
    return {}
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await sheetsRequest('PUT', 'values/settings!A1?valueInputOption=RAW', {
    range: 'settings!A1',
    majorDimension: 'ROWS',
    values: [[JSON.stringify(settings)]],
  })
}
