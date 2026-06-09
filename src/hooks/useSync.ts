import { useEffect } from 'react'
import { useSyncStore } from '@/store/syncStore'
import { fullSync, flush } from '@/services/syncService'

export function useSync() {
  const { setOnline } = useSyncStore()

  useEffect(() => {
    const handleOnline = () => { setOnline(true); void fullSync() }
    const handleOffline = () => setOnline(false)
    // Flush pending writes when user leaves the page
    const handleHide = () => { void flush() }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('pagehide', handleHide)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pagehide', handleHide)
    }
  }, [setOnline])
}
