import { create } from 'zustand'

interface SyncState {
  isSyncing: boolean
  isOnline: boolean
  lastSyncAt: string | null
  pendingCount: number
  syncError: string | null
  setSyncing: (v: boolean) => void
  setOnline: (v: boolean) => void
  setLastSyncAt: (v: string) => void
  setPendingCount: (v: number) => void
  setSyncError: (v: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSyncAt: null,
  pendingCount: 0,
  syncError: null,
  setSyncing: (v) => set({ isSyncing: v }),
  setOnline: (v) => set({ isOnline: v }),
  setLastSyncAt: (v) => set({ lastSyncAt: v }),
  setPendingCount: (v) => set({ pendingCount: v }),
  setSyncError: (v) => set({ syncError: v }),
}))
