import { Menu, LogOut, Settings, ChevronLeft, Cloud, CloudOff, CloudAlert, RefreshCw, Search, SlidersHorizontal, HelpCircle, MessageSquare } from 'lucide-react'
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
const SEARCHABLE: string[] = ['transactions']

export function Header() {
  const { user, logout } = useAuthStore()
  const {
    selectedView, settingsOpen, setSettingsOpen, sidebarOpen, setSidebarOpen,
    helpOpen, setHelpOpen, feedbackOpen, setFeedbackOpen,
    searchQuery, setSearchQuery,
    filterPanelOpen, setFilterPanelOpen,
    filterState,
    categoriesFilterOpen, setCategoriesFilterOpen,
    categoriesPeriod,
    accountsSearch, setAccountsSearch,
    accountsFilter, accountsFilterOpen, setAccountsFilterOpen,
  } = useUIStore()
  const { isOnline, isSyncing, pendingCount, syncError } = useSyncStore()

  const overlayOpen = settingsOpen || helpOpen || feedbackOpen
  const overlayBack = settingsOpen ? () => setSettingsOpen(false)
    : helpOpen ? () => setHelpOpen(false)
    : () => setFeedbackOpen(false)
  const overlayTitle = settingsOpen ? 'Settings' : helpOpen ? 'Short guide' : 'Feedback'

  const showSearch = !overlayOpen && SEARCHABLE.includes(selectedView)

  const handleSignOut = async () => {
    try { await flush() } catch { /* best effort */ }
    await clearLocalData()
    logout()
  }

  const hasFilters = filterState.accountIds.length > 0 || filterState.types.length > 0 ||
    filterState.categoryIds.length > 0 || filterState.dateFrom || filterState.dateTo ||
    filterState.amountMin !== '' || filterState.amountMax !== ''

  const hasCatFilter = categoriesPeriod.from !== '' || categoriesPeriod.to !== ''
  const hasAccFilter = accountsFilter.types.length > 0 || accountsFilter.currencies.length > 0
  const filterActive = selectedView === 'transactions' ? hasFilters
    : selectedView === 'categories' ? hasCatFilter
    : hasAccFilter

  return (
    <TooltipProvider>
    <header className="flex items-center gap-2 px-3 h-14 border-b bg-background flex-shrink-0">

      {/* Left: logo mark + hamburger / back */}
      {overlayOpen ? (
        <Button variant="ghost" size="sm" onClick={overlayBack} aria-label="Back">
          <ChevronLeft size={18} />
        </Button>
      ) : (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden flex items-center justify-center w-9 h-9 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Center: search or title */}
      {overlayOpen ? (
        <span className="font-semibold text-base flex-1">{overlayTitle}</span>
      ) : showSearch ? (
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={selectedView === 'accounts' ? 'Search accounts…' : 'Search by comment…'}
            value={selectedView === 'accounts' ? accountsSearch : searchQuery}
            onChange={e => selectedView === 'accounts' ? setAccountsSearch(e.target.value) : setSearchQuery(e.target.value)}
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
            else if (selectedView === 'categories') setCategoriesFilterOpen(!categoriesFilterOpen)
            else setAccountsFilterOpen(!accountsFilterOpen)
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
        {/* Persistent cloud indicator (mirrors the Android client): cloud with a
            pending-count badge, spinning arrow while a sync is in flight. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void fullSync()}
              className={`relative flex items-center justify-center w-9 h-9 ${
                !isOnline ? 'text-amber-500 dark:text-amber-400'
                : syncError ? 'text-destructive'
                : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Sync status"
            >
              {isSyncing
                ? <RefreshCw size={17} className="animate-spin" />
                : !isOnline ? <CloudOff size={18} />
                : syncError ? <CloudAlert size={18} />
                : <Cloud size={18} />}
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-primary text-primary-foreground text-[10px] leading-[15px] text-center font-medium">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {!isOnline ? `Offline${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
              : syncError ? 'Sync error — tap to retry'
              : isSyncing ? 'Syncing…'
              : pendingCount > 0 ? `${pendingCount} changes pending — tap to sync`
              : 'Synced — tap to refresh'}
          </TooltipContent>
        </Tooltip>
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
              <DropdownMenuItem onClick={() => setHelpOpen(true)}>
                <HelpCircle size={14} className="mr-2" /> Help
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                <MessageSquare size={14} className="mr-2" /> Feedback
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
