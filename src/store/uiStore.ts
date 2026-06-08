import { create } from 'zustand'
import { currentMonthISO } from '@/utils/dateUtils'

export type SelectedView = 'transactions' | 'accounts' | 'categories' | 'analytics'

export interface FilterState {
  accountIds: string[]
  types: string[]
  categoryIds: string[]
  dateFrom: string
  dateTo: string
}

interface UIState {
  selectedView: SelectedView
  settingsOpen: boolean
  sidebarOpen: boolean
  filterState: FilterState
  analyticsMonth: string
  setView: (view: SelectedView) => void
  setSettingsOpen: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  setFilter: (patch: Partial<FilterState>) => void
  clearFilters: () => void
  setAnalyticsMonth: (month: string) => void
}

const emptyFilter: FilterState = {
  accountIds: [],
  types: [],
  categoryIds: [],
  dateFrom: '',
  dateTo: '',
}

export const useUIStore = create<UIState>((set) => ({
  selectedView: 'transactions',
  settingsOpen: false,
  sidebarOpen: false,
  filterState: emptyFilter,
  analyticsMonth: currentMonthISO(),
  setView: (view) => set({ selectedView: view, sidebarOpen: false }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setFilter: (patch) => set((s) => ({ filterState: { ...s.filterState, ...patch } })),
  clearFilters: () => set({ filterState: emptyFilter }),
  setAnalyticsMonth: (month) => set({ analyticsMonth: month }),
}))
