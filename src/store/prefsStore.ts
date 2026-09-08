import { create } from 'zustand'
import { loadSettings, saveSettings } from '@/api/settingsApi'

interface PrefsState {
  baseCurrency: string
  analyticsAccountIds: string[]   // empty = all accounts
  collapsedAccountGroups: string[]
  setBaseCurrency: (currency: string) => void
  setAnalyticsAccountIds: (ids: string[]) => Promise<void>
  toggleAccountGroup: (type: string) => Promise<void>
  load: () => Promise<void>
  save: () => Promise<void>
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  baseCurrency: 'EUR',
  analyticsAccountIds: [],
  collapsedAccountGroups: [],

  setBaseCurrency: (currency) => set({ baseCurrency: currency }),

  setAnalyticsAccountIds: async (ids) => {
    set({ analyticsAccountIds: ids })
    try {
      const settings = await loadSettings()
      await saveSettings({ ...settings, analytics_account_ids: ids })
    } catch { /* non-critical */ }
  },

  toggleAccountGroup: async (type) => {
    const current = get().collapsedAccountGroups
    const next = current.includes(type)
      ? current.filter(g => g !== type)
      : [...current, type]
    set({ collapsedAccountGroups: next })
    try {
      const settings = await loadSettings()
      await saveSettings({ ...settings, collapsed_account_groups: next })
    } catch { /* non-critical */ }
  },

  load: async () => {
    try {
      const settings = await loadSettings()
      if (settings.base_currency) set({ baseCurrency: settings.base_currency })
      if (settings.analytics_account_ids) set({ analyticsAccountIds: settings.analytics_account_ids })
      if (settings.collapsed_account_groups) set({ collapsedAccountGroups: settings.collapsed_account_groups })
    } catch { /* non-critical */ }
  },

  save: async () => {
    try {
      const settings = await loadSettings()
      await saveSettings({
        ...settings,
        base_currency: get().baseCurrency,
        analytics_account_ids: get().analyticsAccountIds,
        collapsed_account_groups: get().collapsedAccountGroups,
      })
    } catch { /* non-critical */ }
  },
}))
