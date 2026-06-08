import { create } from 'zustand'
import { loadSettings, saveSettings } from '@/api/settingsApi'

interface PrefsState {
  baseCurrency: string
  setBaseCurrency: (currency: string) => void
  load: () => Promise<void>
  save: () => Promise<void>
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  baseCurrency: 'EUR',

  setBaseCurrency: (currency) => set({ baseCurrency: currency }),

  load: async () => {
    try {
      const settings = await loadSettings()
      if (settings.base_currency) set({ baseCurrency: settings.base_currency })
    } catch { /* non-critical */ }
  },

  save: async () => {
    try {
      const settings = await loadSettings()
      await saveSettings({ ...settings, base_currency: get().baseCurrency })
    } catch { /* non-critical */ }
  },
}))
