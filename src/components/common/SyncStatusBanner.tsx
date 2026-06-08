import { useSyncStore } from '@/store/syncStore'
import { fullSync } from '@/services/syncService'
import { RefreshCw, WifiOff, AlertCircle } from 'lucide-react'

export function SyncStatusBanner() {
  const { isOnline, isSyncing, pendingCount, syncError } = useSyncStore()

  if (isOnline && !isSyncing && pendingCount === 0 && !syncError) return null

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
        <WifiOff size={14} />
        <span>Offline{pendingCount > 0 ? ` · ${pendingCount} changes pending` : ''}</span>
      </div>
    )
  }

  if (syncError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm dark:bg-red-950 dark:border-red-800 dark:text-red-300">
        <AlertCircle size={14} />
        <span>Sync error</span>
        <button onClick={() => void fullSync()} className="underline ml-auto">Retry</button>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
        <RefreshCw size={14} className="animate-spin" />
        <span>Syncing...</span>
      </div>
    )
  }

  return null
}
