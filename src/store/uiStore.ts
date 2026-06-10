import { create } from 'zustand'
import { currentMonthISO } from '@/utils/dateUtils'

export type SelectedView = 'transactions' | 'accounts' | 'categories' | 'analytics'

export interface FilterState {
  accountIds: string[]
  types: string[]
  categoryIds: string[]
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
}

export interface PeriodState {
  from: string
  to: string
}

interface UIState {
  selectedView: SelectedView
  settingsOpen: boolean
  sidebarOpen: boolean
  filterState: FilterState
  filterPanelOpen: boolean
  searchQuery: string
  categoriesPeriod: PeriodState
  categoriesFilterOpen: boolean
  accountsSearch: string
  accountsFilter: { types: string[]; currencies: string[] }
  accountsFilterOpen: boolean
  analyticsMonth: string
  setView: (view: SelectedView) => void
  setSettingsOpen: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  setFilter: (patch: Partial<FilterState>) => void
  clearFilters: () => void
  setFilterPanelOpen: (v: boolean) => void
  setSearchQuery: (q: string) => void
  setCategoriesPeriod: (p: PeriodState) => void
  setCategoriesFilterOpen: (v: boolean) => void
  setAccountsSearch: (q: string) => void
  setAccountsFilter: (f: { types: string[]; currencies: string[] }) => void
  setAccountsFilterOpen: (v: boolean) => void
  setAnalyticsMonth: (month: string) => void
}

const emptyFilter: FilterState = {
  accountIds: [],
  types: [],
  categoryIds: [],
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
}

export const useUIStore = create<UIState>((set) => ({
  selectedView: 'transactions',
  settingsOpen: false,
  sidebarOpen: false,
  filterState: emptyFilter,
  filterPanelOpen: false,
  searchQuery: '',
  categoriesPeriod: { from: '', to: '' },
  categoriesFilterOpen: false,
  accountsSearch: '',
  accountsFilter: { types: [], currencies: [] },
  accountsFilterOpen: false,
  analyticsMonth: currentMonthISO(),
  setView: (view) => set({ selectedView: view, sidebarOpen: false }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setFilter: (patch) => set((s) => ({ filterState: { ...s.filterState, ...patch } })),
  clearFilters: () => set({ filterState: emptyFilter }),
  setFilterPanelOpen: (v) => set({ filterPanelOpen: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setCategoriesPeriod: (p) => set({ categoriesPeriod: p }),
  setCategoriesFilterOpen: (v) => set({ categoriesFilterOpen: v }),
  setAccountsSearch: (q) => set({ accountsSearch: q }),
  setAccountsFilter: (f) => set({ accountsFilter: f }),
  setAccountsFilterOpen: (v) => set({ accountsFilterOpen: v }),
  setAnalyticsMonth: (month) => set({ analyticsMonth: month }),
}))
