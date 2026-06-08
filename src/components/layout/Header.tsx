import { Menu, LogOut, Settings, ChevronLeft, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSyncStore } from '@/store/syncStore'
import { flush, clearLocalData, fullSync } from '@/services/syncService'

export function Header() {
  const { user, logout } = useAuthStore()
  const { selectedView, settingsOpen, setSettingsOpen, sidebarOpen, setSidebarOpen } = useUIStore()
  const { isOnline, isSyncing, pendingCount, syncError } = useSyncStore()

  const VIEW_LABELS: Record<string, string> = {
    transactions: 'Transactions',
    accounts: 'Accounts',
    categories: 'Categories',
    analytics: 'Analytics',
  }

  const handleSignOut = async () => {
    try { await flush() } catch { /* best effort */ }
    await clearLocalData()
    logout()
  }

  return (
    <TooltipProvider>
    <header className="flex items-center gap-3 px-4 h-14 border-b bg-background flex-shrink-0">
      {settingsOpen ? (
        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)} aria-label="Back">
          <ChevronLeft size={18} />
        </Button>
      ) : (
        <Button
          variant="ghost" size="sm"
          className="md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu size={18} />
        </Button>
      )}

      <span className="font-semibold text-base">
        {settingsOpen ? 'Settings' : VIEW_LABELS[selectedView]}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {/* Sync status indicator */}
        {!isOnline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-amber-500 dark:text-amber-400"><WifiOff size={16} /></span>
            </TooltipTrigger>
            <TooltipContent>{pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline'}</TooltipContent>
          </Tooltip>
        )}
        {isOnline && syncError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => void fullSync()} className="text-destructive"><AlertCircle size={16} /></button>
            </TooltipTrigger>
            <TooltipContent>Sync error — tap to retry</TooltipContent>
          </Tooltip>
        )}
        {isOnline && !syncError && isSyncing && (
          <span className="text-muted-foreground"><RefreshCw size={16} className="animate-spin" /></span>
        )}
        {isOnline && !syncError && !isSyncing && pendingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => void fullSync()} className="text-muted-foreground"><RefreshCw size={16} /></button>
            </TooltipTrigger>
            <TooltipContent>{pendingCount} changes pending</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-1">
        {user && (
          <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors">
                      {user.picture ? (
                        <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {user.name[0]}
                        </div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 border-b">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                      <Settings size={14} className="mr-2" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleSignOut()} className="text-destructive">
                      <LogOut size={14} className="mr-2" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>{user.email}</TooltipContent>
            </Tooltip>
        )}
      </div>
    </header>
    </TooltipProvider>
  )
}
