import { create } from 'zustand'
import { loadSettings, saveSettings } from '@/api/settingsApi'

interface PrefsState {
  baseCurrency: string
  analyticsAccountIds: string[]   // empty = all accounts
  setBaseCurrency: (currency: string) => void
  setAnalyticsAccountIds: (ids: string[]) => Promise<void>
  load: () => Promise<void>
  save: () => Promise<void>
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  baseCurrency: 'EUR',
  analyticsAccountIds: [],

  setBaseCurrency: (currency) => set({ baseCurrency: currency }),

  setAnalyticsAccountIds: async (ids) => {
    set({ analyticsAccountIds: ids })
    try {
      const settings = await loadSettings()
      await saveSettings({ ...settings, analytics_account_ids: ids })
    } catch { /* non-critical */ }
  },

  load: async () => {
    try {
      const settings = await loadSettings()
      if (settings.base_currency) set({ baseCurrency: settings.base_currency })
      if (settings.analytics_account_ids) set({ analyticsAccountIds: settings.analytics_account_ids })
    } catch { /* non-critical */ }
  },

  save: async () => {
    try {
      const settings = await loadSettings()
      await saveSettings({
        ...settings,
        base_currency: get().baseCurrency,
        analytics_account_ids: get().analyticsAccountIds,
      })
    } catch { /* non-critical */ }
  },
}))
