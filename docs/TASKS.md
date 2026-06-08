# Money PWA — TASKS.md

> Implementation backlog. Work top to bottom. One task at a time.
> Mark `[x]` when complete. Never skip ahead.

---

## Stage 1 — Project scaffold

- [x] **1.1** Initialise Vite + React + TypeScript project (`npm create vite@latest`). Configure `tsconfig.app.json` (ES2022, strict). Add `.env.example` with `VITE_GOOGLE_CLIENT_ID`.
- [x] **1.2** Install all dependencies from `PRD.md §2`. Verify `npm run build` passes.
- [x] **1.3** Copy Tailwind config and `index.css` CSS custom properties verbatim from Tasks PWA `docs/tech-spec.md §11`. Confirm tokens match exactly.
- [x] **1.4** Create folder structure: `src/types`, `src/utils`, `src/services`, `src/api`, `src/store`, `src/hooks`, `src/components/layout`, `src/components/common`.
- [x] **1.5** Add GitHub Actions deploy workflow (`.github/workflows/deploy.yml`) as specified in `ARCHITECTURE.md §11`. Set `base` in `vite.config.ts`.
- [x] **1.6** Configure `vite-plugin-pwa`: app name "Money", theme color `#e07e38`, icons 192/512, `autoUpdate`.

---

## Stage 2 — Types, utils, constants

- [x] **2.1** Write all TypeScript interfaces: `src/types/transaction.ts`, `account.ts`, `category.ts`, `sync.ts`, `sheets.ts`. Match fields exactly from `PRD.md §5`.
- [x] **2.2** `src/utils/constants.ts`: sheet names (`SHEET_TRANSACTIONS`, etc.), column index objects (`TRANSACTION_COLS`, `ACCOUNT_COLS`, `CATEGORY_COLS`).
- [x] **2.3** `src/utils/uuid.ts`: `generateId(prefix: string)` using `crypto.randomUUID()`.
- [x] **2.4** `src/utils/dateUtils.ts`: `now()` → ISO 8601 string, `todayISO()` → `YYYY-MM-DD`, `formatDate(iso)` → localised display string, `parseDate(str)`.
- [x] **2.5** `src/utils/currencyUtils.ts`: `formatAmount(amount, currency)` → display string, `convertToBase(amount, currency, rates)` → number.
- [x] **2.6** `src/utils/sheetsMapper.ts`: `rowToTransaction`, `transactionToRow`, `rowToAccount`, `accountToRow`, `rowToCategory`, `categoryToRow`.

---

## Stage 3 — Dexie & offline queue

- [x] **3.1** `src/services/db.ts`: define `MoneyDB extends Dexie`, schema version 1 with tables `transactions`, `accounts`, `categories`, `queue`. Exactly as in `ARCHITECTURE.md §5`.
- [x] **3.2** `src/services/offlineQueue.ts`: `enqueue()`, `getPending()`, `markDone()`, `markFailed()`, `markProcessing()`, `getQueueLength()`. Same logic as Tasks PWA.

---

## Stage 4 — Auth & Google APIs

- [x] **4.1** `src/services/authService.ts`: load GIS script dynamically, `initAuth()`, `refreshToken(prompt?)`.
- [x] **4.2** `src/store/authStore.ts`: Zustand store with `persist` to `localStorage` (`auth-storage`). Fields: `user`, `accessToken`, `tokenExpiry`, `spreadsheetId`. Actions: `login()`, `logout()`, `setSpreadsheetId()`. On rehydration: check `tokenExpiry`; if expired attempt silent refresh; only surface LoginPage if refresh fails.
- [x] **4.3** `src/api/sheetsClient.ts`: `sheetsRequest(method, path, body?)`. Auth header from `authStore`. 401 → silent refresh → retry once → throw. Row cache: `Map<entityId, rowIndex>`, `invalidateRowCache()`.
- [x] **4.4** `src/api/driveApi.ts`: `listUserSheets()` — search Drive for spreadsheets owned by user.
- [x] **4.5** `src/api/spreadsheetSetup.ts`: `ensureSpreadsheet()` — search Drive for `db_money`; if not found create it and return `isNew: true`.
- [x] **4.6** `src/api/seedOnboarding.ts`: write all sheet headers + 2 seed accounts (Cash €, Cash ₽) + 3 seed categories (Groceries, Transport, Health) via single `values:batchUpdate`.

---

## Stage 5 — Sheets API modules

- [x] **5.1** `src/api/transactionsApi.ts`: `ensureHeader()`, `fetchAllTransactions()`, `appendTransaction()`, `updateTransaction()`.
- [x] **5.2** `src/api/accountsApi.ts`: `ensureHeader()`, `fetchAllAccounts()`, `appendAccount()`, `updateAccount()`.
- [x] **5.3** `src/api/categoriesApi.ts`: `ensureHeader()`, `fetchAllCategories()`, `appendCategory()`, `updateCategory()`.
- [x] **5.4** `src/api/settingsApi.ts`: `loadSettings()`, `saveSettings()` — single JSON blob at `settings!A1`.

---

## Stage 6 — Exchange rates

- [x] **6.1** `src/services/exchangeRateService.ts`: `fetchExchangeRates(baseCurrency)` using `frankfurter.app`. Cache result in `exchangeRateStore`. On failure read last known from settings.
- [x] **6.2** `src/store/exchangeRateStore.ts`: `rates`, `baseCurrency`, `setRates()`, `getRate(currency)`.

---

## Stage 7 — Zustand stores

- [x] **7.1** `src/store/transactionsStore.ts`: `transactions[]`, `addTransaction(input)`, `updateTransaction(id, patch)`, `deleteTransaction(id)`, `upsertMany(incoming[])`. `addTransaction` and `updateTransaction` compute `amount_base`, call `accountsStore.adjustBalance`, enqueue writes, schedule flush.
- [x] **7.2** `src/store/accountsStore.ts`: `accounts[]`, `addAccount()`, `updateAccount()`, `archiveAccount()`, `adjustBalance(id, delta)`, `upsertMany()`. Balance update always enqueues an `account/update`.
- [x] **7.3** `src/store/categoriesStore.ts`: `categories[]` (sorted by `sort_order`), `addCategory()`, `updateCategory()`, `deleteCategory(id, transferToId)`, `reorder(ids[])`, `upsertMany()`. `deleteCategory` reassigns all transactions before deleting.
- [x] **7.4** `src/store/prefsStore.ts`: `baseCurrency`, `load()` (from settings sheet), `save()`.
- [x] **7.5** `src/store/syncStore.ts`: `isSyncing`, `isOnline`, `lastSyncAt`, `pendingCount`, `syncError`.
- [x] **7.6** `src/store/uiStore.ts`: `selectedView`, `settingsOpen`, `filterState` (account ids, types, category ids, dateFrom, dateTo), `analyticsMonth` (YYYY-MM string). Actions: `setView()`, `setFilter()`, `clearFilters()`, `setAnalyticsMonth()`.

---

## Stage 8 — Sync service

- [x] **8.1** `src/services/syncService.ts`: `flush()`, `pull()`, `initialLoad()`, `fullSync()`, `scheduleFlush()` (800ms debounce). `flush()` deduplicates queue by `(entityType, entityId, operationType)`. `pull()` calls all three `fetchAll` functions in parallel, calls `upsertMany` on each store.
- [x] **8.2** `src/hooks/useSync.ts`: register `window` event listeners — `online` → `fullSync()`, `visibilitychange` (stale > 5min) → `fullSync()`, `pagehide` → `flush()`.

---

## Stage 9 — App shell & auth gate

- [x] **9.1** `src/App.tsx`: reads `authStore`; renders `<LoginPage>` or `<AppShell>`. On mount: if token valid → `initialLoad()`; if expired → silent refresh → `initialLoad()` or `<LoginPage>`.
- [x] **9.2** `src/components/layout/LoginPage.tsx`: app logo (Wallet icon + "Money"), tagline, "Sign in with Google" button. Same layout as Tasks PWA LoginPage.
- [x] **9.3** `src/components/layout/Header.tsx`: hamburger (opens drawer), title, user avatar dropdown (Settings, Sign out). Matches Tasks PWA Header layout exactly.
- [x] **9.4** `src/components/layout/Drawer.tsx`: nav links — Transactions, Accounts, Categories, Analytics. Same Radix Sheet drawer as Tasks PWA Sidebar. Desktop: persistent `<aside>`.
- [x] **9.5** `src/components/layout/AppShell.tsx`: Header + Drawer + main content area. Overlay: `settingsOpen` → `<SettingsPage>` with back chevron.
- [x] **9.6** `src/components/common/SyncStatusBanner.tsx`: Offline / Syncing / Error variants. Identical to Tasks PWA.
- [x] **9.7** `src/components/common/Toast.tsx`: bottom-center auto-dismiss toast. Identical to Tasks PWA.
- [x] **9.8** `src/components/common/ConfirmDialog.tsx`: generic confirm/cancel dialog. Identical to Tasks PWA.

---

## Stage 10 — Transactions screen

- [x] **10.1** `src/hooks/useTransactions.ts`: `useTransactionsByDate()` — returns transactions grouped by date descending, each group with date label and daily net total. `useFilteredTransactions(filterState)` — applies account/type/category/date range filters.
- [x] **10.2** `src/components/transactions/TransactionItem.tsx`: two-row layout. Row 1: category icon circle (colored background) | category name | amount (colored by type). Row 2: account name. Tap → edit modal.
- [x] **10.3** `src/components/common/FilterBar.tsx`: chip row — Account, Type, Category, Date range. Each chip opens a bottom sheet or popover. Active chips show count badge. "Clear all" when any filter active.
- [x] **10.4** `src/components/transactions/TransactionList.tsx`: grouped list with date headers and daily totals. FilterBar at top. Balance summary bar (total across non-archived, non-investment accounts in base currency). FAB (+).
- [x] **10.5** Confirm Transactions view is the default (`uiStore` initialises to `'transactions'`).

---

## Stage 11 — Transaction modal

- [x] **11.1** `src/components/transactions/TransactionModal.tsx` — Expense tab: amount input + currency selector, category picker (icon grid filtered by `is_expense`), account picker, date picker, comment field. Save creates transaction, updates balance, enqueues, flushes.
- [x] **11.2** TransactionModal — Income tab: same fields, category picker filtered by `is_income`.
- [x] **11.3** TransactionModal — Transfer tab: from account + amount + currency, to account + to_amount + to_currency (auto-fill if same currency), date, comment. Saves one transaction record, updates both balances.
- [x] **11.4** TransactionModal — Debt tab: subtype selector (I lent / I borrowed), amount + currency, account, date, comment. Open debt shown with "Mark as repaid" button when editing; tap creates a closing transaction with `debt_ref_id`.
- [x] **11.5** Edit mode: pre-fills all fields from existing transaction. Save calls `updateTransaction` (reverses old balance delta, applies new). Delete calls `deleteTransaction` (reverses balance delta), confirms first.

---

## Stage 12 — Accounts screen

- [x] **12.1** `src/components/accounts/AccountModal.tsx`: fields — name, currency (EUR/RUB/USD), type (card/cash/savings/investment), opening balance (new only), archive toggle (edit only).
- [x] **12.2** `src/components/accounts/AccountsPage.tsx`: four sections — Cards & Accounts (`card`), Savings (`savings`), Investments (`investment`), Debts (derived). Each section collapsible. Each account row: icon by type, name, balance. "Show archived" toggle at bottom. FAB (+) opens AccountModal. Tap row → AccountModal edit mode.
- [x] **12.3** Debts section: derive from open `debt_lent` / `debt_borrowed` transactions. Group by comment (counterpart name). Show total outstanding per person with +/− indicator.

---

## Stage 13 — Categories screen

- [x] **13.1** `src/components/common/ColorPicker.tsx`: grid of ~18 preset hex swatches — base hues (red, orange, yellow, light green, green, dark green, teal, cyan, sky blue, blue, purple, pink, grey, black) in two tones each. Selected swatch: checkmark overlay. No free colour input.
- [x] **13.2** `src/components/common/IconPicker.tsx`: scrollable grid of curated lucide-react icon names relevant to personal finance. Search field. Selected icon: primary-color ring. Suggested icons: `ShoppingCart`, `UtensilsCrossed`, `Car`, `Bus`, `Heart`, `Pill`, `Shirt`, `Home`, `Zap`, `Wifi`, `Gamepad2`, `Plane`, `GraduationCap`, `Gift`, `Dumbbell`, `Coffee`, `Baby`, `PawPrint`, `Wrench`, `Banknote`, `TrendingUp`, `BookOpen`, `Music`, `Camera`, `Scissors`, `Sparkles`.
- [x] **13.3** `src/components/categories/CategoryModal.tsx`: icon picker + color picker at top (tap circle to open each). Name field. Expense toggle + limit input. Income toggle + limit input. Delete button (edit mode) → `ConfirmDialog` → if confirmed, show second dialog "Move transactions to:" category selector → execute reassignment + deletion.
- [x] **13.4** `src/components/categories/CategoriesPage.tsx`: drag-to-reorder list via `@dnd-kit`. Each row: colored icon circle, name, expense chip (with limit if set), income chip. FAB (+). Tap row → CategoryModal edit. Reorder writes `sort_order` to all affected categories and enqueues updates.

---

## Stage 14 — Analytics screen

- [x] **14.1** `src/components/analytics/MonthBarChart.tsx`: recharts `BarChart`. Last 12 months on X-axis (abbreviated month names). Bar height = sum of `amount_base` for `expense` transactions in that month. Selected month bar at full `--primary` opacity, others at 40%. Tap bar → sets `uiStore.analyticsMonth`.
- [x] **14.2** `src/components/analytics/CategoryDonut.tsx`: recharts `PieChart` with `innerRadius`. Segments in `sort_order` order, each colored by `category.color`. Centre label: total expenses for selected month in base currency. Below donut: category list — icon, name, actual amount, limit (if set), status indicator (green check / red cross if exceeded), thin progress bar.
- [x] **14.3** `src/components/analytics/AnalyticsPage.tsx`: layout top to bottom — MonthBarChart, month selector (`← May 2026 →`), CategoryDonut + list. Scrollable. `analyticsMonth` defaults to current month.

---

## Stage 15 — Settings screen

- [x] **15.1** `src/components/settings/SettingsPage.tsx`: two cards. Card 1 (first): Spreadsheet — current name/ID, "Change" button → popover with `listUserSheets()` results; selecting a new sheet clears Dexie + reruns `initialLoad()`. Card 2: Base currency — select EUR / USD / RUB; on change saves to `prefsStore` + settings sheet + re-fetches exchange rates.

---

## Stage 16 — Polish & PWA

- [x] **16.1** Add `manifest.webmanifest` fields: `name: "Money"`, `short_name: "Money"`, `theme_color: "#e07e38"`, `background_color: "#ffffff"`, `display: "standalone"`, `start_url`.
- [ ] **16.2** Verify offline mode: kill network, add a transaction, come back online — confirm it syncs.
- [ ] **16.3** Verify persistent login: sign in, reload page — confirm no login prompt appears.
- [ ] **16.4** Verify dark mode: toggle OS dark mode — confirm all screens render correctly with dark tokens.
- [ ] **16.5** Test on mobile viewport (375px): check FAB placement, drawer, modal inputs, chart readability.
- [ ] **16.6** Confirm GitHub Actions deploy runs cleanly and the live URL is accessible.
