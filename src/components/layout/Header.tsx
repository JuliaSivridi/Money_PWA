import { Menu, LogOut, Settings, ChevronLeft, WifiOff, RefreshCw, AlertCircle, Search, SlidersHorizontal, Coins } from 'lucide-react'
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

/** Views that show a search field + filter button in the header */
const SEARCHABLE: string[] = ['transactions', 'categories']

export function Header() {
  const { user, logout } = useAuthStore()
  const {
    selectedView, settingsOpen, setSettingsOpen, sidebarOpen, setSidebarOpen,
    searchQuery, setSearchQuery,
    filterPanelOpen, setFilterPanelOpen,
    filterState,
    categoriesFilterOpen, setCategoriesFilterOpen,
    categoriesPeriod,
  } = useUIStore()
  const { isOnline, isSyncing, pendingCount, syncError } = useSyncStore()

  const showSearch = !settingsOpen && SEARCHABLE.includes(selectedView)

  const handleSignOut = async () => {
    try { await flush() } catch { /* best effort */ }
    await clearLocalData()
    logout()
  }

  const hasFilters = filterState.accountIds.length > 0 || filterState.types.length > 0 ||
    filterState.categoryIds.length > 0 || filterState.dateFrom || filterState.dateTo ||
    filterState.amountMin !== '' || filterState.amountMax !== ''

  const hasCatFilter = categoriesPeriod.from !== '' || categoriesPeriod.to !== ''
  const filterActive = selectedView === 'transactions' ? hasFilters : hasCatFilter

  return (
    <TooltipProvider>
    <header className="flex items-center gap-2 px-3 h-14 border-b bg-background flex-shrink-0">

      {/* Left: logo mark + hamburger / back */}
      {settingsOpen ? (
        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)} aria-label="Back">
          <ChevronLeft size={18} />
        </Button>
      ) : (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden flex items-center gap-1.5 shrink-0"
          aria-label="Menu"
        >
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Coins size={15} className="text-primary-foreground" />
          </div>
          <Menu size={18} className="text-muted-foreground" />
        </button>
      )}

      {/* Center: search or title */}
      {settingsOpen ? (
        <span className="font-semibold text-base flex-1">Settings</span>
      ) : showSearch ? (
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by comment…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-muted/40 focus:outline-none focus:border-primary focus:bg-background"
          />
        </div>
      ) : (
        <span className="flex-1 font-semibold text-base capitalize">{selectedView}</span>
      )}

      {/* Filter button for searchable views */}
      {showSearch && (
        <button
          onClick={() => {
            if (selectedView === 'transactions') setFilterPanelOpen(!filterPanelOpen)
            else setCategoriesFilterOpen(!categoriesFilterOpen)
          }}
          className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
            filterActive
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Filters"
        >
          <SlidersHorizontal size={16} />
        </button>
      )}

      {/* Right: sync status + avatar */}
      <div className="flex items-center gap-1.5 shrink-0">
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
        {user && (
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
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
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
        )}
      </div>
    </header>
    </TooltipProvider>
  )
}
