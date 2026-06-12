# Money PWA — Technical Specification

**Version:** 1.2 · **Date:** 2026-06-12  
**Repository:** D:\Projects\Money-PWA  
**Stack:** React 19 · TypeScript 5.9 · Vite 7 · Zustand 5 · Dexie 4 · Google Sheets API v4

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Package / Folder Structure](#4-package--folder-structure)
5. [Data Model](#5-data-model)
6. [Database / Storage Schema](#6-database--storage-schema)
7. [Authentication & First-Launch Setup](#7-authentication--first-launch-setup)
8. [Synchronization / API Layer](#8-synchronization--api-layer)
9. [UI Screens](#9-ui-screens)
10. [Key Components](#10-key-components)
11. [Theme & Colors](#11-theme--colors)
12. [Navigation](#12-navigation)
13. [Loading & Empty States](#13-loading--empty-states)
14. [CI/CD & Build](#14-cicd--build)
15. [First-Time Setup (New Developer)](#15-first-time-setup-new-developer)
16. [Key Algorithms](#16-key-algorithms)

---

## 1. Overview

Money PWA is an offline-first personal finance tracker. The user's own Google Sheets spreadsheet acts as the remote database — no dedicated backend is required. The app reads and writes directly to the Sheets API using OAuth2 access tokens obtained through Google Identity Services.

**Key design decisions:**

- **Google Sheets as database.** Removes the need for a backend server, hosting costs, and auth infrastructure beyond Google's OAuth2 flow. Trade-off: no real-time multi-device sync; each device reconciles on startup and on reconnect.
- **Offline-first via Dexie (IndexedDB).** All reads come from local IndexedDB; writes go to a local queue and are flushed to Sheets asynchronously. The UI never waits for the network.
- **No persistent server-side access token.** Google Identity Services issues short-lived OAuth2 access tokens (typically 3600 s). The app silently re-requests a token using `prompt: ''` on startup; if the user's Google session has lapsed they see the login screen.
- **No React Router.** Navigation is a single Zustand state field (`selectedView`). The app is a single-page app with four panels; no URL-based routing exists.
- **Multi-category transactions.** Each transaction carries up to two category IDs. The first ID is the *primary* category used for analytics aggregation. The second is a tag. This avoids double-counting while enabling richer labelling.
- **Sibling design system.** The app shares CSS custom properties and Tailwind tokens with Tasks PWA, ensuring visual identity consistency.

---

## 2. Tech Stack

| Layer | Library | Version | Notes |
|---|---|---|---|
| UI framework | react | 19.2.0 | StrictMode enabled |
| UI framework | react-dom | 19.2.0 | |
| Build tool | vite | 7.3.1 | base `/Money_PWA/` |
| Language | typescript | ~5.9.3 | strict mode |
| Styling | tailwindcss | 3.4.19 | darkMode: 'media' |
| Styling plugin | tailwindcss-animate | 1.0.7 | |
| State management | zustand | 5.0.11 | persist middleware for auth |
| Local database | dexie | 4.3.0 | IndexedDB wrapper, db name MoneyDB2 |
| Form handling | react-hook-form | 7.71.2 | |
| Schema validation | zod | 4.3.6 | |
| UI primitives | @radix-ui/react-dialog | 1.1.15 | |
| UI primitives | @radix-ui/react-dropdown-menu | 2.1.16 | |
| UI primitives | @radix-ui/react-label | 2.1.8 | |
| UI primitives | @radix-ui/react-popover | 1.1.15 | |
| UI primitives | @radix-ui/react-scroll-area | 1.2.10 | |
| UI primitives | @radix-ui/react-select | 2.2.6 | |
| UI primitives | @radix-ui/react-separator | 1.1.8 | |
| UI primitives | @radix-ui/react-slot | 1.2.4 | |
| UI primitives | @radix-ui/react-tabs | 1.1.12 | |
| UI primitives | @radix-ui/react-tooltip | 1.2.8 | |
| Icons | lucide-react | 0.575.0 | only icon library used |
| Charts | recharts | 2.15.3 | PieChart, BarChart |
| Drag-and-drop | @dnd-kit/core | 6.3.1 | category reorder |
| Drag-and-drop | @dnd-kit/sortable | 10.0.0 | |
| Drag-and-drop | @dnd-kit/utilities | 3.2.2 | |
| Date utilities | date-fns | 4.1.0 | |
| Date picker | react-day-picker | 9.14.0 | (imported; native input used in modals) |
| Google auth | @react-oauth/google | 0.13.4 | (imported; GIS script used directly) |
| Class utilities | clsx | 2.1.1 | |
| Class utilities | class-variance-authority | 0.7.1 | |
| Class utilities | tailwind-merge | 3.5.0 | |
| PWA | vite-plugin-pwa | 1.2.0 | Workbox, autoUpdate |
| Form resolvers | @hookform/resolvers | 5.2.2 | zodResolver |

---

## 3. Architecture

**Pattern:** Zustand store layer over Dexie (IndexedDB) as primary data source; Google Sheets API as remote backend. No dedicated BFF or backend.

### Data-flow diagram

```
User action
    │
    ▼
React Component
    │  calls store action
    ▼
Zustand Store  ──────────────────────────────────────────────────────►  IndexedDB (Dexie)
    │                                                                       │
    │  enqueue('create'|'update'|'delete', payload)                        │  bulkPut / delete
    ▼                                                                       │
offlineQueue (Dexie queue table)                                            │
    │                                                                       │
    │  scheduleFlush() — 800 ms debounce                                   │
    ▼                                                                       │
syncService.flush()                                                         │
    │  dedup: latest per (entity:id:operation)                             │
    │  for each item: sheetsClient → Sheets API (append or PUT row)        │
    │  on success: markDone (delete from queue)                            │
    │  on failure: markFailed, retryCount++                                │
    ▼                                                                       │
syncService.pull()                                                          │
    │  fetch all 3 tables in parallel                                       │
    │  upsertMany → delete orphans, bulkPut newer records                  │
    └──────────────────────────────────────────────────────────────────────►
                                                                    React re-render
                                                                (set({ transactions: all }))
```

### Write path (user creates a transaction)

1. Component calls `useTransactionsStore.addTransaction(input)`.
2. Store computes `amount_base` via `convertToBase`.
3. `db.transactions.add(t)` — written to IndexedDB synchronously.
4. `enqueue('transaction', 'create', id, t)` — adds to `queue` table.
5. State updated optimistically: `set((s) => ({ transactions: [t, ...s.transactions] }))`.
6. `adjustBalance` called on the account (also writes to IndexedDB + queue).
7. `scheduleFlush()` — sets/resets a 800 ms timeout that calls `flush()`.
8. `flush()` deduplicates queue, calls `appendTransaction(t)` → `POST` to Sheets API.

### Read path (on app startup)

1. `AppShell.useEffect` → `initialLoad()`.
2. `ensureTransactionHeader()` / `ensureAccountHeader()` / `ensureCategoryHeader()` — checks row 1 exists, writes it if missing.
3. `flush()` — pushes any offline queue to Sheets first.
4. `pull()` — parallel GET for all three ranges; each store's `upsertMany` runs.
5. `upsertMany`: deletes local records absent from Sheets, bulkPuts newer records.
6. Store sets `transactions / accounts / categories` array; React re-renders.
7. On network failure: `loadFromDb()` — reads from IndexedDB, no network needed.

### Error handling

- HTTP 401: `sheetsClient` catches it, calls `refreshToken()`, retries once.
- Refresh fails: throws `'Session expired. Please sign in again.'`
- Any sync error: stored in `syncStore.syncError`; Header shows `AlertCircle` icon that triggers `fullSync()` on tap.
- Queue items failing persistently: `retryCount` incremented up to 5; items with `retryCount >= 5` are excluded from `getPending()`.

---

## 4. Package / Folder Structure

```
Money-PWA/
├── .github/workflows/deploy.yml      CI/CD: build + publish to GitHub Pages
├── docs/                             Project documentation
├── enrich/                           Data-migration scripts (ZenMoney CSV → import CSVs)
├── public/icons/                     PWA icon assets
├── src/
│   ├── main.tsx                      React root — StrictMode, createRoot
│   ├── App.tsx                       Auth gate: shows LoginPage or AppShell
│   ├── index.css                     CSS custom properties (design tokens), Tailwind base
│   ├── vite-env.d.ts                 Vite env type declarations
│   │
│   ├── api/                          All Google API calls (no fetch in components/stores)
│   │   ├── sheetsClient.ts           Token management, HTTP wrapper, row-index cache, deleteRowByEntityId
│   │   ├── transactionsApi.ts        fetch/append/update transactions sheet
│   │   ├── accountsApi.ts            fetch/append/update accounts sheet
│   │   ├── categoriesApi.ts          fetch/append/update categories sheet
│   │   ├── settingsApi.ts            loadSettings/saveSettings — settings!A1 JSON blob
│   │   ├── spreadsheetSetup.ts       checkSpreadsheet / createSpreadsheet (drive.file scope; no silent search)
│   │   └── seedOnboarding.ts         Write starter data for brand-new spreadsheets
│   │
│   ├── services/
│   │   ├── db.ts                     Dexie MoneyDB2 class (v1→v2 migration)
│   │   ├── syncService.ts            flush / pull / initialLoad / fullSync / scheduleFlush
│   │   ├── offlineQueue.ts           enqueue / getPending / markDone / markFailed
│   │   ├── authService.ts            loadGISScript / initAuth / setTokenClient
│   │   ├── picker.ts                 Google Picker (openSpreadsheetPicker); requires VITE_GOOGLE_API_KEY
│   │   └── exchangeRateService.ts    fetchExchangeRates from fawazahmed0/currency-api (jsDelivr CDN)
│   │
│   ├── store/                        One Zustand store per domain
│   │   ├── authStore.ts              user, accessToken, tokenExpiry, spreadsheetId (persisted)
│   │   ├── transactionsStore.ts      CRUD + upsertMany + balance side-effects
│   │   ├── accountsStore.ts          CRUD + adjustBalance + upsertMany
│   │   ├── categoriesStore.ts        CRUD + reorder + deleteCategory (transfer txns)
│   │   ├── syncStore.ts              isSyncing, isOnline, pendingCount, syncError
│   │   ├── uiStore.ts                selectedView, filterState, analyticsMonth, settingsOpen
│   │   ├── prefsStore.ts             baseCurrency (persisted to settings sheet)
│   │   └── exchangeRateStore.ts      rates map + getRate(currency)
│   │
│   ├── hooks/
│   │   ├── useSync.ts                window online/offline/pagehide listeners
│   │   └── useTransactions.ts        useTransactionsByDate / useFilteredTransactions / useTotalBalance
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          Main layout: Header + Drawer (sidebar) + main panel
│   │   │   ├── Header.tsx            Title, sync status icons, user avatar dropdown
│   │   │   ├── Drawer.tsx            Navigation: 4 items (Wallet/CreditCard/Tag/BarChart2)
│   │   │   └── LoginPage.tsx         Centered card with Google sign-in button
│   │   │
│   │   ├── transactions/
│   │   │   ├── TransactionList.tsx   Balance bar, FilterBar, date-grouped list, infinite scroll, FAB
│   │   │   ├── TransactionModal.tsx  Create/edit dialog: 4 tabs, category grid, NumericKeyboard
│   │   │   └── TransactionItem.tsx   Single row: stacked icons, colored account name, amount
│   │   │
│   │   ├── accounts/
│   │   │   ├── AccountsPage.tsx      Sections (cash/card/savings/investment), archive toggle
│   │   │   └── AccountModal.tsx      Create/edit: color swatch + name, currency, type, opening balance
│   │   │
│   │   ├── categories/
│   │   │   ├── CategoriesPage.tsx    Drag-and-drop sortable list, FAB
│   │   │   └── CategoryModal.tsx     Create/edit: icon+color preview, name, expense/income limits
│   │   │
│   │   ├── help/
│   │   │   └── HelpPage.tsx              Basics, data & sync, usage tips overlay
│   │   ├── feedback/
│   │   │   └── FeedbackPage.tsx          Posts to VITE_FEEDBACK_URL with app=Money
│   │   ├── analytics/
│   │   │   ├── AnalyticsPage.tsx          MonthBarChart + YearlyChart + MonthlyView
│   │   │   ├── YearlyChart.tsx            ComposedChart: income/expense bars + balance line; date pickers + period chips
│   │   │   ├── MonthlyView.tsx            Month nav + DatePicker fields + period chips + CategoryDonut
│   │   │   ├── CategoryDonut.tsx          PieChart with SVG icon labels + category list with spend-vs-limit bars
│   │   │   ├── MonthBarChart.tsx          12-month trailing expense bar chart (Recharts, h=120)
│   │   │   ├── IncomeExpenseChart.tsx     Standalone income vs expense bar chart
│   │   │   ├── BalanceChart.tsx           Standalone balance line chart
│   │   │   └── AnalyticsAccountPicker.tsx Account filter for YearlyChart balance calculation
│   │   │
│   │   ├── settings/
│   │   │   └── SettingsPage.tsx      Switch spreadsheet, set base currency
│   │   │
│   │   ├── common/
│   │   │   ├── CategoryIcon.tsx      Round icon container: bg=category.color, icon=white
│   │   │   ├── ColorPicker.tsx       22-swatch grid (11 cols, 28px circles)
│   │   │   ├── IconPicker.tsx        37 lucide icons, searchable, 6-col grid
│   │   │   ├── NumericKeyboard.tsx   4×3 grid (digits + . + ⌫), max 2 decimals
│   │   │   ├── FAB.tsx               Floating action button (fixed bottom-right, primary)
│   │   │   ├── FilterBar.tsx         Active filter chips row; hidden when no filters
│   │   │   ├── FilterPanel.tsx       Full filter panel with DatePicker date range fields
│   │   │   ├── DatePicker.tsx        DD.MM.YYYY display + showPicker() + calendar icon
│   │   │   ├── ConfirmDialog.tsx     Generic delete-confirm dialog
│   │   │   ├── SyncStatusBanner.tsx  Sync status display (imported, not used in AppShell)
│   │   │   └── Toast.tsx             Toast notification component
│   │   │
│   │   └── ui/                       Radix-based shadcn/ui primitives
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── label.tsx
│   │       ├── popover.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx            SelectContent has onWheel stopPropagation (prevents modal jitter)
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── tabs.tsx
│   │       └── tooltip.tsx
│   │
│   ├── types/
│   │   ├── transaction.ts            Transaction, TransactionType, TransactionInput
│   │   ├── account.ts                Account, AccountType, AccountInput
│   │   ├── category.ts               Category, CategoryInput
│   │   ├── debt.ts                   DebtSummary
│   │   ├── sync.ts                   QueueItem, EntityType, OperationType
│   │   └── sheets.ts                 SheetsGetResponse, SheetsBatchUpdateRequest
│   │
│   └── utils/
│       ├── constants.ts              Sheet names, column index maps, range strings
│       ├── sheetsMapper.ts           rowToX / xToRow for all three entities
│       ├── currencyUtils.ts          formatAmount (Intl), convertToBase
│       ├── dateUtils.ts              now, todayISO, formatDate, formatMonthYear, currentMonthISO
│       ├── uuid.ts                   generateId(prefix) using crypto.randomUUID
│       └── lib/utils.ts             cn() — clsx + tailwind-merge
```

---

## 5. Data Model

### Transaction

| Field | Type | Description |
|---|---|---|
| `localId` | `number?` | Dexie auto-increment (not stored in Sheets) |
| `id` | `string` | `txn_` + 8 hex chars from randomUUID |
| `date` | `string` | ISO date `yyyy-MM-dd` |
| `type` | `TransactionType` | One of: `expense`, `income`, `transfer`, `debt_lent`, `debt_borrowed` |
| `amount` | `number` | Transaction amount in the account's currency |
| `currency` | `string` | ISO currency code (e.g. `EUR`, `RUB`) |
| `amount_base` | `number` | Amount converted to base currency (computed on create/update) |
| `account_id` | `string` | Source account ID |
| `category_ids` | `string[]` | Up to 2 category IDs. Index 0 = primary (used for analytics). Index 1 = tag only. Serialised as comma-separated string in Sheets. |
| `to_account_id` | `string` | Destination account (transfers only; empty string otherwise) |
| `to_amount` | `number` | Amount received in destination account (used for cross-currency transfers) |
| `to_currency` | `string` | Destination currency (transfers only) |
| `debt_ref_id` | `string` | For debt repayments: ID of the originating debt transaction |
| `comment` | `string` | Free text comment / payee |
| `created_at` | `string` | ISO 8601 timestamp |
| `updated_at` | `string` | ISO 8601 timestamp |

**`TransactionInput`** = `Omit<Transaction, 'localId' | 'id' | 'created_at' | 'updated_at'>`

**Debt invariant:** A debt transaction with `debt_ref_id = ''` is an *open* debt. When the user presses "Mark as repaid", a new transaction is created with `type` = the same debt type and `debt_ref_id` = the original transaction's `id`. The balance effect is reversed.

**Balance delta logic (from `computeBalanceDelta`):**

| type | accountId delta | toAccountId delta |
|---|---|---|
| expense | `-amount` | — |
| income | `+amount` | — |
| transfer | `-amount` | `+to_amount` |
| debt_lent (open) | `-amount` | — |
| debt_lent (repayment: debt_ref_id set) | `+amount` | — |
| debt_borrowed (open) | `+amount` | — |
| debt_borrowed (repayment) | `-amount` | — |

---

### Account

| Field | Type | Description |
|---|---|---|
| `localId` | `number?` | Dexie auto-increment |
| `id` | `string` | `acc_` + 8 hex chars |
| `name` | `string` | Display name |
| `currency` | `string` | ISO currency code |
| `type` | `AccountType` | `card` \| `cash` \| `savings` \| `investment` |
| `color` | `string` | Hex color string (e.g. `#3b82f6`). Fallback: `#6b7280` |
| `balance` | `number` | Current balance (maintained by `adjustBalance`) |
| `archived` | `boolean` | Hidden from active lists when `true` |
| `sort_order` | `number` | Display order within type sections |
| `created_at` | `string` | ISO 8601 timestamp |
| `updated_at` | `string` | ISO 8601 timestamp |

**Note:** `balance` in Google Sheets is a denormalised value. The store's `adjustBalance` both updates IndexedDB and enqueues an account update to Sheets. Do not compute balances from transactions inline; always use `accountsStore.adjustBalance()`.

---

### Category

| Field | Type | Description |
|---|---|---|
| `localId` | `number?` | Dexie auto-increment |
| `id` | `string` | `cat_` + 8 hex chars |
| `name` | `string` | Display name |
| `icon` | `string` | lucide-react icon name (e.g. `ShoppingCart`). Fallback: `Tag` |
| `color` | `string` | Hex color string. Fallback: `#6b7280` |
| `is_expense` | `boolean` | Whether usable for expense transactions |
| `expense_limit` | `number` | Monthly spending limit (0 = no limit) |
| `is_income` | `boolean` | Whether usable for income transactions |
| `income_limit` | `number` | Monthly income target (0 = no target) |
| `sort_order` | `number` | Position in categories list; user-draggable |
| `created_at` | `string` | ISO 8601 timestamp |
| `updated_at` | `string` | ISO 8601 timestamp |

**Delete invariant:** Deleting a category requires choosing a target category. All transactions referencing the deleted category have the deleted ID replaced (preserving array position) and deduplicated before being re-saved.

---

### QueueItem (offline write queue)

| Field | Type | Description |
|---|---|---|
| `localId` | `number?` | Dexie auto-increment (primary key) |
| `entityType` | `'transaction' \| 'account' \| 'category'` | |
| `operationType` | `'create' \| 'update' \| 'delete'` | |
| `entityId` | `string` | Entity's domain ID (e.g. `txn_abc12345`) |
| `payload` | `Record<string, unknown>` | Full entity snapshot at time of write |
| `createdAt` | `string` | ISO 8601 timestamp |
| `status` | `'pending' \| 'processing' \| 'failed'` | |
| `retryCount` | `number` | Incremented on failure; excluded when ≥ 5 |

---

### DebtSummary (computed, not stored)

| Field | Type | Description |
|---|---|---|
| `counterpart` | `string` | Debt counterpart name (from transaction `comment`) |
| `type` | `'lent' \| 'borrowed'` | |
| `totalAmount` | `number` | |
| `currency` | `string` | |
| `transactions` | `string[]` | Transaction IDs comprising this debt |

---

## 6. Database / Storage Schema

### IndexedDB — Dexie `MoneyDB2`

Database name changed from `MoneyDB` to `MoneyDB2` to avoid Dexie's "cannot change primary key" restriction when migrating the `transactions` primary key. Old `MoneyDB` data is abandoned and re-synced from Sheets.

**Version 1 → Version 2 migration** (`upgrade` callback): For every transaction, if `category_ids` is not already an array, read `category_id` string, wrap in `[category_id]` or `[]`, delete the old field.

| Table | Dexie schema string (v2) | Notes |
|---|---|---|
| `transactions` | `id, date, type, account_id, *category_ids, updated_at` | `*` = multi-entry index enabling `.where('category_ids').equals(id)` |
| `accounts` | `id, type, archived, updated_at` | |
| `categories` | `id, sort_order, updated_at` | |
| `queue` | `++localId, status, entityType, entityId, createdAt` | `++` = auto-increment primary key |

---

### Google Sheets — `db_money` spreadsheet

Spreadsheet title constant: `SPREADSHEET_TITLE = 'db_money'`

#### Sheet: `transactions` (range `transactions!A:O`)

| Col | Index | Field | Format |
|---|---|---|---|
| A | 0 | `id` | string, e.g. `txn_a1b2c3d4` |
| B | 1 | `date` | `yyyy-MM-dd` |
| C | 2 | `type` | `expense` \| `income` \| `transfer` \| `debt_lent` \| `debt_borrowed` |
| D | 3 | `amount` | decimal string, e.g. `42.50` |
| E | 4 | `currency` | ISO code, e.g. `EUR` |
| F | 5 | `amount_base` | decimal string |
| G | 6 | `account_id` | `acc_` prefixed string |
| H | 7 | `category_ids` | comma-separated IDs, e.g. `cat_abc,cat_xyz` |
| I | 8 | `to_account_id` | `acc_` prefixed or empty |
| J | 9 | `to_amount` | decimal string or `0` |
| K | 10 | `to_currency` | ISO code or empty |
| L | 11 | `debt_ref_id` | transaction ID or empty |
| M | 12 | `comment` | string |
| N | 13 | `created_at` | ISO 8601 datetime |
| O | 14 | `updated_at` | ISO 8601 datetime |

Header row: `id,date,type,amount,currency,amount_base,account_id,category_ids,to_account_id,to_amount,to_currency,debt_ref_id,comment,created_at,updated_at`

#### Sheet: `accounts` (range `accounts!A:J`)

| Col | Index | Field | Format |
|---|---|---|---|
| A | 0 | `id` | `acc_` prefixed |
| B | 1 | `name` | string |
| C | 2 | `currency` | ISO code; default `EUR` |
| D | 3 | `type` | `card` \| `cash` \| `savings` \| `investment` |
| E | 4 | `balance` | decimal string |
| F | 5 | `archived` | `TRUE` \| `FALSE` |
| G | 6 | `sort_order` | integer string |
| H | 7 | `created_at` | ISO 8601 |
| I | 8 | `updated_at` | ISO 8601 |
| J | 9 | `color` | hex color, e.g. `#3b82f6`; default `#6b7280` |

#### Sheet: `categories` (range `categories!A:K`)

| Col | Index | Field | Format |
|---|---|---|---|
| A | 0 | `id` | `cat_` prefixed |
| B | 1 | `name` | string |
| C | 2 | `icon` | lucide-react name; default `Tag` |
| D | 3 | `color` | hex; default `#6b7280` |
| E | 4 | `is_expense` | `TRUE` \| `FALSE`; **note: default is `TRUE`** — only explicitly `FALSE` is treated as false |
| F | 5 | `expense_limit` | decimal string or `0` |
| G | 6 | `is_income` | `TRUE` \| `FALSE`; default `FALSE` |
| H | 7 | `income_limit` | decimal string or `0` |
| I | 8 | `sort_order` | integer string |
| J | 9 | `created_at` | ISO 8601 |
| K | 10 | `updated_at` | ISO 8601 |

#### Sheet: `settings`

Single cell `A1` contains a JSON blob:

```json
{ "base_currency": "EUR", "exchange_rates": { "USD": 1.08, "RUB": 95.4, ... } }
```

Exchange rates are cached here as a fallback for when the fawazahmed0/currency-api (jsDelivr CDN) is unreachable.

---

### localStorage (`money-auth`)

Persisted by Zustand `persist` middleware. Only auth/session data; not transaction data.

| Key | Type | Description |
|---|---|---|
| `user` | `{ name, email, picture }` or `null` | Google user profile |
| `accessToken` | `string` or `null` | Current OAuth2 access token |
| `tokenExpiry` | `number` or `null` | `Date.now() + expiresIn * 1000` |
| `spreadsheetId` | `string` | ID of the active Google Sheets file |
| `spreadsheetName` | `string` | Display name of the active spreadsheet |

**`isAuthenticated`** is not persisted — it is recomputed on startup from the token validity check.

Additional localStorage key (not Zustand): `money-lastAccountId` — stores the last account selected in TransactionModal, used to pre-fill the account field on next open.

---

## 7. Authentication & First-Launch Setup

### OAuth2 scopes

```
email
profile
https://www.googleapis.com/auth/drive.file
```

`drive.file` grants access **only** to files this app created or that the user explicitly picked via the Google Picker — the app cannot list or search the rest of Drive. This replaces the old `spreadsheets + drive.readonly` pair.

### Sign-in flow (step by step)

1. `App.tsx` mounts. Calls `initAuth()` (idempotent — only runs once).
2. `initAuth` dynamically injects `https://accounts.google.com/gsi/client` script (id `gis-script`). Waits for `window.onGISLoaded`.
3. `google.accounts.oauth2.initTokenClient` is called with `CLIENT_ID`, scopes, and `login_hint` (user's email from persisted state if available).
4. `setTokenClient(client)` stores the client in a module-level variable.
5. Back in `App.tsx`:
   - If `isAuthenticated` is already `true` → skip (token was valid in this session).
   - Else if `accessToken` exists and `tokenExpiry > Date.now() + 60_000` → call `setToken(accessToken, remaining)` to mark authenticated without a network round-trip.
   - Else if `user` exists (returning user, token expired) → call `refreshToken()` silently (no prompt shown; browser uses existing Google session cookie).
   - If `refreshToken()` throws → `isAuthenticated` remains `false`, `LoginPage` is shown.
6. If `isAuthenticated` is `false` → render `LoginPage`.
7. User taps "Sign in with Google" → `refreshToken()` → GIS shows consent/account-chooser popup.
8. GIS callback fires with `access_token` → `resolveTokenRequest(token, expiresIn)`:
   - `setToken` called: stores token, sets `tokenExpiry = Date.now() + expiresIn * 1000`, `isAuthenticated = true`.
   - Fetches `https://www.googleapis.com/oauth2/v3/userinfo` → `setUser({ name, email, picture })`.
9. React re-renders; `isAuthenticated = true` → `AppShell` mounts.

### AppShell first-launch setup

10. `AppShell.useEffect` (runs once):
    a. `loadFromCache()` — reads all three Dexie tables into Zustand first; UI is usable before any network call.
    b. `fetchExchangeRates(baseCurrency)` — GET fawazahmed0/currency-api (jsDelivr CDN) → stores in `exchangeRateStore` and caches to `settings!A1`.
    c. `checkSpreadsheet()` — verifies the stored `spreadsheetId` via Drive `files/{id}` GET.
       - Returns `'ready'` → `initialLoad()` → `prefs.load()`
       - Returns `'setup'` → renders **SetupScreen** (user must choose create-new or pick-existing before the app is usable)

### SetupScreen

Shown when `checkSpreadsheet()` returns `'setup'` (first install, or after scope migration). Two actions:

- **Create new spreadsheet** → `createSpreadsheet()` (Sheets API POST) → `seedOnboarding()` → `initialLoad()`
- **Pick existing file** → `openSpreadsheetPicker()` from `src/services/picker.ts` (Google Picker dialog) → sets `spreadsheetId` → `initialLoad()`

`picker.ts` loads `https://apis.google.com/js/api.js` lazily and opens the native Picker limited to spreadsheets. Requires `VITE_GOOGLE_API_KEY` env var (Cloud project API key, unrestricted or restricted to the Picker API).

### Token refresh

- Proactive: `sheetsClient.getToken()` refreshes if `tokenExpiry < Date.now() + 60_000` (1 minute before expiry).
- Reactive: on HTTP 401, `sheetsClient` calls `refreshToken()` and retries the request once.
- `refreshToken()` is a Promise that resolves when GIS callback fires with a new token, or rejects if GIS returns an error.

---

## 8. Synchronization / API Layer

### `sheetsClient.ts` — HTTP wrapper

All API calls go through `sheetsRequest<T>(method, path, body?)`. Base URL: `https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/`.

**Row-index cache (`rowCache: Map<string, number>`):**
- `findRowIndex(sheet, entityId)` fetches column A lazily, populates cache for all IDs, returns the 1-based row number.
- Cache is invalidated after `flush()` via `invalidateRowCache()`.
- Purpose: avoid a full column scan on every update.

### `syncService.ts` — Core sync operations

#### `flush()` — push local queue to Sheets

```
1. getPending() → items where status in ['pending','failed'] AND retryCount < 5
2. Dedup: keep only latest item per (entityType:entityId:operationType) key
3. Mark superseded duplicates as done (delete them)
4. For each latest item:
   a. markProcessing(localId)
   b. processQueueItem:
      - transaction create → appendTransaction (POST append)
      - transaction delete → deleteRowByEntityId(SHEET_TRANSACTIONS, entityId)
      - transaction update → updateTransaction (PUT row)
      - account create/update / category create/update → same pattern
   c. markDone(localId) on success → deleted from queue
   d. markFailed(localId, retryCount+1) on exception
5. invalidateRowCache()
6. setPendingCount(await getQueueLength())
```

#### `pull()` — fetch Sheets → update IndexedDB

```
1. invalidateRowCache()  — another device may have reordered/removed rows since last flush
2. Parallel: fetchAllTransactions, fetchAllAccounts, fetchAllCategories
3. pendingIds = Set of entityIds with unsent local changes (from offlineQueue)
4. Parallel: upsertMany(incoming, pendingIds) for each store
5. setLastSyncAt(now())
```

**`upsertMany(incoming, pendingIds)` pattern:**

```
1. existing = await db.TABLE.toArray()
2. incomingIds = new Set(incoming.map(t => t.id))
3. toDelete = existing.filter(t => !incomingIds.has(t.id) && !pendingIds.has(t.id))
   ↑ entities with unsent local edits are NOT deleted even if absent from Sheets
4. if toDelete.length > 0: db.TABLE.bulkDelete(toDelete.map(t => t.id))
5. toStore = incoming.filter(item => !pendingIds.has(item.id) && (!local || item.updated_at > local.updated_at))
   ↑ do not overwrite locally pending records with potentially stale Sheet data
6. if toStore.length > 0: db.TABLE.bulkPut(toStore)
7. set({ TABLE: (await db.TABLE.toArray()).sort(...) })
```

This is a **true sync** with **pending-item safety**: remote deletions propagate, but locally pending edits survive a pull without being overwritten or deleted.

#### `initialLoad()` — on app startup

```
1. setSyncing(true); setSyncError(null)
2. ensureTransactionHeader() + ensureAccountHeader() + ensureCategoryHeader() (parallel)
3. flush()
4. pull()
5. On any error: setSyncError(message); loadFromDb() for all three stores (offline mode)
6. finally: setSyncing(false); setPendingCount(getQueueLength())
```

#### `scheduleFlush()` — debounced background push

Called after every write action (addTransaction, updateTransaction, etc.). Debounces with a 800 ms timeout. Guards against re-entrancy with `_flushing` flag.

#### `fullSync()` — network reconnect

Called when `window` fires `online` event. Guards against concurrent execution with `isSyncing` check. Sequence: `flush()` → `pull()`.

### Sync triggers

| Event | Action |
|---|---|
| App startup (AppShell mount) | `initialLoad()` |
| `window` fires `online` | `fullSync()` |
| `window` fires `pagehide` | `flush()` (best-effort) |
| Any write action | `scheduleFlush()` (800 ms debounce) |

**No periodic sync.** The `visibilitychange` periodic sync was intentionally removed to avoid spurious spinner activity.

### API methods summary

| Function | HTTP | Endpoint | Notes |
|---|---|---|---|
| `fetchAllTransactions` | GET | `values/transactions!A:O` | Skips row 0 (header), skips rows with empty col A |
| `appendTransaction` | POST | `values/transactions!A:O:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS` | |
| `updateTransaction` | PUT | `values/transactions!A{n}:O{n}?valueInputOption=RAW` | Fallback: append if row not found |
| `ensureTransactionHeader` | GET + PUT | `values/transactions!A1:O1` | Writes header only if row 1 is empty |
| (same pattern for accounts, categories) | | | |
| `ensureSpreadsheet` | GET Drive + POST Sheets | | Creates spreadsheet if not found |
| `listUserSheets` | GET Drive | `files?q=mimeType=...&orderBy=modifiedTime+desc` | |
| `loadSettings` / `saveSettings` | GET / PUT | `values/settings!A1` | JSON blob in single cell |
| Exchange rates | GET | `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.json` | Not through sheetsClient |

---

## 9. UI Screens

### 9.1 LoginPage

**File:** `src/components/layout/LoginPage.tsx`  
**Shown when:** `isAuthenticated === false`

**Layout:**
- `min-h-dvh` centered flex column
- App logo: `w-12 h-12 bg-primary rounded-xl` with `Wallet` icon (24px, `text-primary-foreground`)
- Title: "Money" (`text-2xl font-bold`) + subtitle "Personal finance tracker"
- Body text: "Data stored in your Google Sheets." / "Works offline with automatic sync."
- Sign-in button: full-width, `size="lg"`, inline Google SVG icon (20×20px, 4-path)
- Button text: "Sign in with Google" / "Signing in..." while loading

**Action:** Button click → `refreshToken()` → GIS popup → token → `isAuthenticated = true` → `AppShell` renders.

---

### 9.2 AppShell

**File:** `src/components/layout/AppShell.tsx`

**Layout:**
- `flex flex-col h-dvh bg-background`
- `Header` (fixed height `h-14`)
- Below header: `flex flex-1 overflow-hidden`
  - Desktop (`md:`): `aside w-60 border-r` containing `Drawer`
  - Mobile: Radix `Sheet` (side="left", w-60) opened by hamburger in Header
  - `main flex-1 overflow-hidden` — renders one of: `TransactionList`, `AccountsPage`, `CategoriesPage`, `AnalyticsPage`, or `SettingsPage`

**Overlays:** `settingsOpen`, `helpOpen`, `feedbackOpen` each replace the `main` area; Header shows a `ChevronLeft` back button. Only one overlay is open at a time (opening one closes others).

**Startup sequence:** `loadFromCache` (immediate) → `fetchExchangeRates` → `checkSpreadsheet` → if ready: `initialLoad` + `prefs.load`; if setup: show SetupScreen.

---

### 9.3 Header

**File:** `src/components/layout/Header.tsx`

**Left side:**
- Settings open: `ChevronLeft` button → `setSettingsOpen(false)`
- Normal: `Menu` button (`md:hidden`) → toggles `sidebarOpen`
- Title: `selectedView` mapped to `{ transactions: 'Transactions', accounts: 'Accounts', categories: 'Categories', analytics: 'Analytics' }` or `'Settings'`

**Right side — sync indicator (priority order):**
1. Offline: `WifiOff` (16px, amber-500) with tooltip "Offline · N pending" or "Offline"
2. Online + error: `AlertCircle` (16px, destructive) with tooltip "Sync error — tap to retry" → `fullSync()`
3. Online + no error + syncing: `RefreshCw` (16px, animate-spin, muted-foreground)
4. Online + no error + not syncing + pendingCount > 0: `RefreshCw` (16px, not spinning) → `fullSync()`

**User avatar:**
- `w-8 h-8 rounded-full border-2 border-border`
- Shows `<img>` if `user.picture` exists, else initials div with `bg-primary`
- Opens `DropdownMenu`: user name + email, Settings, Help, Feedback, Sign out
- Opening any overlay closes the others (`setSettingsOpen / setHelpOpen / setFeedbackOpen` each set the others to false)
- Sign out: `flush()` → `clearLocalData()` → `logout()`

---

### 9.4 Drawer (Navigation)

**File:** `src/components/layout/Drawer.tsx`

Four navigation items in `flex flex-col gap-1 p-3`:

| `view` | Label | Icon |
|---|---|---|
| `transactions` | Transactions | `Wallet` |
| `accounts` | Accounts | `CreditCard` |
| `categories` | Categories | `Tag` |
| `analytics` | Analytics | `BarChart2` |

Active item: `bg-accent text-accent-foreground`. Inactive: `text-muted-foreground hover:bg-accent`.

---

### 9.5 TransactionList

**File:** `src/components/transactions/TransactionList.tsx`

**Data sources:**
- `useTransactionsByDate()` → all transactions grouped by date, sorted descending
- `useFilteredTransactions(filterState)` → filtered subset
- `useAccountsStore` for balance bar

**Balance bar:**
- Sum of accounts where `!archived && type !== 'investment'`
- Displayed with `formatAmount(total, baseCurrency)`

**Filter display:** `FilterBar` rendered below balance bar; hidden when no filters active.

**Infinite scroll:**
- `PAGE_SIZE = 20` date-groups per page
- `visibleCount` state, reset to `PAGE_SIZE` on filter/data change
- `IntersectionObserver` on sentinel `<div>` with `rootMargin: '200px'`
- Sentinel renders when `hasMore` is true; loads next 20 groups on intersection

**Date group header:**
- Left: formatted label (e.g. `14 Jun · Saturday` or `14 Jun 2023 · Wednesday` for past years)
- Right: daily net in `text-green-400` (positive) or `text-red-400` (negative), via `amount_base`

**Empty state:** `Wallet` icon (40px, opacity-20), "No transactions yet", "+ Add transaction" ghost button.

**FAB:** `fixed bottom-6 right-6 w-14 h-14 bg-primary rounded-full`, `Plus` icon (24px).

---

### 9.6 TransactionModal

**File:** `src/components/transactions/TransactionModal.tsx`

**Validation schema (zod):**

| Field | Rule |
|---|---|
| `amount` | `z.string().min(1)` |
| `currency` | `z.string()` |
| `category_ids` | `z.array(z.string())` |
| `account_id` | `z.string().min(1, 'Select account')` |
| `to_account_id` | `z.string()` |
| `to_amount` | `z.string()` |
| `to_currency` | `z.string()` |
| `date` | `z.string().min(1)` |
| `comment` | `z.string()` |
| `debt_subtype` | `z.enum(['lent', 'borrowed'])` |
| `debt_ref_id` | `z.string()` |

**Tabs:** Expense · Income · Transfer · Debt

**Form layout (each tab):**
1. `DateInput` (overlaid native `<input type="date">`)
2. Category grid (expense/income tabs only; sorted by usage frequency desc)
3. Account select + AmountField in one row
4. Comment input

**Transfer tab additionally:** From account + amount, then To account (if cross-currency: side-by-side with to_amount field).

**Debt tab additionally:** "I lent" / "I borrowed" toggle, comment as "Person's name", "Mark as repaid" button (edit mode only, when `debt_ref_id` is empty).

**Category grid:**
- `grid grid-cols-4 gap-2`, `max-h-36 overflow-y-auto`
- Each cell: `CategoryIcon` (16px) + name (xs, truncate)
- Selected: `border-primary bg-accent`; badge `top-1 right-1` shows position number (1=primary orange, 2=secondary gray)
- Max 2 selections; tapping a 3rd replaces index 1

**AmountField:** `w-28 shrink-0 text-right`; highlighted with `ring-2 ring-ring` when active.

**Account select trigger:** colored dot (2.5×2.5, `rounded-full`, `backgroundColor: account.color`) + account name.

**Numeric keyboard:** Shared; `activeField` toggles between `'amount'` and `'to_amount'`.

**Footer:** Delete (destructive, `mr-auto`) only in edit mode; Cancel + Save on right. Delete triggers `ConfirmDialog` with "This will reverse the balance change."

**Last account persistence:** Selected `account_id` written to `localStorage['money-lastAccountId']` on Save.

---

### 9.7 AccountsPage

**File:** `src/components/accounts/AccountsPage.tsx`

**Section order (explicit):** `['cash', 'card', 'savings', 'investment']`

**Section component:**
- Collapsible (default open); `ChevronDown` / `ChevronRight` toggle
- Header: icon + label + count (right-aligned)
- Sections with 0 accounts render null

**AccountRow:**
- Icon container: `w-8 h-8 rounded-full`, `backgroundColor: color + '33'` (20% opacity), `color: color`
- Icon: type-specific (`Wallet`, `CreditCard`, `PiggyBank`, `TrendingUp`), 16px
- Balance: negative amounts → `text-red-400`

**Archived section:** Hidden by default; toggled by "Show/Hide archived (N)" text button.

**Open debts section:** Rendered below account sections. Shows debt transactions where `!debt_ref_id` and whose `id` does not appear as anyone's `debt_ref_id`. Amount in `text-red-400` (lent) or `text-green-400` (borrowed).

**Empty state:** `CreditCard` icon (40px, opacity-20), "No accounts yet".

---

### 9.8 CategoriesPage

**File:** `src/components/categories/CategoriesPage.tsx`

**Drag-and-drop:** `@dnd-kit/core` with `closestCenter` collision detection.
- `PointerSensor`: activation distance 8px (prevents accidental drag on tap)
- `KeyboardSensor` with `sortableKeyboardCoordinates`
- `SortableContext` with `verticalListSortingStrategy`
- `handleDragEnd`: `arrayMove` → `reorder(newOrder.map(c => c.id))`

**SortableCategory row:**
- Drag handle: `GripVertical` (16px), `cursor-grab`, `touch-none` (stops scroll interference)
- `CategoryIcon` + name + type badges (expense: rose; income: emerald; limit shown if > 0)

**Empty state:** `Tag` icon (40px, opacity-20), "No categories yet".

---

### 9.9 AnalyticsPage

**File:** `src/components/analytics/AnalyticsPage.tsx`

**Layout (top to bottom):**
1. `MonthBarChart` — 12-month trailing expense bar (tapping a bar sets `analyticsMonth`)
2. `YearlyChart` — income/expense/balance composed chart with date pickers
3. `MonthlyView` — month navigation + category donut + breakdown list

**State:** `analyticsMonth` in `uiStore`, default `currentMonthISO()` (format `yyyy-MM`). Clicking a bar in MonthBarChart or YearlyChart sets `analyticsMonth`; MonthlyView nav arrows do the same.

---

#### MonthBarChart

- `BarChart` 120px height, 12 bars for trailing 12 months
- `XAxis`: `format(d, 'MMM')` labels; no axis lines; `font-size: 11`, `fill: hsl(var(--muted-foreground))`
- Selected month bar fill: `hsl(var(--primary))` (full opacity); others at 35% opacity
- Click on bar → `setAnalyticsMonth(month)`
- Data: expense transactions only, sum `amount_base`

---

#### YearlyChart

**File:** `src/components/analytics/YearlyChart.tsx`

- `ComposedChart` with `Bar` (income + negExpense) and `Line` (balance)
- **Year navigation** `← 2025 →` header — `goYear(delta)` sets full calendar year in date fields
- **Date fields** (always visible) — two `DatePicker` components for From / To; editing sets chip to `'custom'`
- **Period chips** — `This year` / `1Y` / `2Y` / `3Y`; each fills date fields relative to today. `RotateCcw` appears when not on default chip
- **Series toggles** — Income / Expenses / Balance (each independently toggleable)
- **Balance line** reconstructed backwards from `currentBalance` using `monthlyNet` per month. `AnalyticsAccountPicker` (gear icon) selects which accounts are included
- `INCOME_COLOR = 'hsl(142 71% 45%)'`; `EXPENSE_COLOR = 'hsl(0 72% 51%)'`
- Click on a bar → `onMonthClick(month)` → `analyticsMonth` updated

---

#### MonthlyView

**File:** `src/components/analytics/MonthlyView.tsx`

- **Month navigation** `← May 2026 →` — updates `analyticsMonth` in `uiStore`
- **Date fields** (always visible) — two `DatePicker` components; editing sets `customMode = true`
- **Period chips** — `Month` / `3M` / `6M` / `Year`; always anchor to end of `dateTo`:
  - `Month` = single calendar month
  - `3M` / `6M` = rolling N months ending at dateTo
  - `Year` = rolling 12 months ending at dateTo
- **`RotateCcw`** next to date fields; visible when `dateFrom / dateTo ≠ current month defaults`
- **Expenses / Income toggle** — full-width tab bar; income amount always `text-green-500`
- `CategoryDonut` receives `dateFrom`, `dateTo`, `isAverage`, `monthCount`, `todayFraction`, `periodLabel`

---

#### CategoryDonut

**File:** `src/components/analytics/CategoryDonut.tsx`

- `PieChart` height=290, `Pie` `cy=145 innerRadius=60 outerRadius=90 paddingAngle=2 stroke="none"`
- **Icon labels** rendered as pure SVG `<g>` elements (no `foreignObject`): `<circle r=13 fill=color>` + `<LucideIcon x y size=18>`; shown only for segments > 3%
- SVG viewport math: icon extent = `cy ± (outerRadius + 30 + 13)` = `[12, 278]` ⊂ `[0, 290]` → 12px clearance each side
- Only **primary** category (`category_ids[0]`) used per transaction (avoids double-counting)
- Centre text: total / average in base currency + period abbreviation (e.g. `3M`, `avg /6M`)
- Category list below: icon | name | amount | limit status (✓/✗) + limit value; thin progress bar
- `todayFraction` marker: `w-0.5 bg-foreground/60`, `top: '-0.3rem'`, shown in single-current-month view only
- **Empty state:** `BarChart2` icon (40px, opacity-20), "No data for this period"

---

### 9.10 SettingsPage

**File:** `src/components/settings/SettingsPage.tsx`

**Spreadsheet card:**
- Shows `spreadsheetName` (or `'db_money'` fallback)
- "Change" button → `openSpreadsheetPicker()` (native Google Picker dialog) → on pick: clears local Dexie data, invalidates row cache, calls `setSpreadsheet(id, name)`, then `initialLoad()`
- No Drive file list dropdown (removed with `driveApi.ts`)

**Base currency card:**
- Select: EUR / USD / RUB
- Changing: `setBaseCurrency` → `save()` (writes to settings sheet) → `fetchExchangeRates(currency)` (updates fawazahmed0/currency-api (jsDelivr CDN) rates and re-caches)

---

## 10. Key Components

### 10.1 CategoryIcon

**File:** `src/components/common/CategoryIcon.tsx`

```typescript
function CategoryIcon({ icon, color, size = 16 }: { icon: string; color: string; size?: number })
```

- Container: `rounded-full`, size `(size + 12) × (size + 12)` px (via inline style)
- Background: `color` prop
- Icon: looked up as `(icons as Record<string, LucideIcon>)[icon]`, fallback `icons.Tag`
- Icon color: always `#fff`, size = `size` prop

---

### 10.2 NumericKeyboard

**File:** `src/components/common/NumericKeyboard.tsx`

```typescript
function NumericKeyboard({ value, onChange }: { value: string; onChange: (v: string) => void })
```

**Key layout:**

```
1  2  3
4  5  6
7  8  9
.  0  ⌫
```

**Rules:**
- `⌫`: removes last character
- `.`: appends `.` (only once); if value is empty, prepends `0`
- Digit: if value is `'0'`, replace entirely; if already has decimal part > 2 digits, block
- Uses `onPointerDown` + `e.preventDefault()` to prevent focus loss from modal inputs
- `touchAction: 'manipulation'` on each button

---

### 10.3 ColorPicker

**File:** `src/components/common/ColorPicker.tsx`

```typescript
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void })
```

- 22 hardcoded swatches in 11-column grid
- Each swatch: `w-7 h-7 rounded-full` (28px circle)
- Selected: shows `Check` icon (14px, white, strokeWidth 3)

**Swatch palette (pairs):**
`#ef4444` / `#dc2626` · `#f97316` / `#ea580c` · `#eab308` / `#ca8a04` · `#22c55e` / `#16a34a` · `#10b981` / `#059669` · `#14b8a6` / `#0d9488` · `#06b6d4` / `#0891b2` · `#3b82f6` / `#2563eb` · `#8b5cf6` / `#7c3aed` · `#ec4899` / `#db2777` · `#6b7280` / `#374151`

---

### 10.4 IconPicker

**File:** `src/components/common/IconPicker.tsx`

```typescript
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void })
```

- Search input filters by name (case-insensitive)
- 6-column grid, `max-h-48 overflow-y-auto`
- Each icon button: `w-10 h-10`, icon 18px; selected: `border-primary bg-accent ring-2 ring-primary`
- 37 available icon names: `ShoppingCart`, `UtensilsCrossed`, `Car`, `Bus`, `Heart`, `Pill`, `Shirt`, `Home`, `Zap`, `Wifi`, `Smartphone`, `Gamepad2`, `Plane`, `GraduationCap`, `Gift`, `Dumbbell`, `Coffee`, `Smile`, `Sprout`, `Baby`, `PawPrint`, `Wrench`, `Banknote`, `TrendingUp`, `HandCoins`, `Landmark`, `PiggyBank`, `BookOpen`, `Music`, `Scissors`, `Sparkles`, `Tag`, `ShoppingBag`, `Fuel`, `Train`, `Beer`

---

### 10.5 FilterBar

**File:** `src/components/common/FilterBar.tsx`

```typescript
function FilterBar({ filterState }: { filterState: FilterState })
```

- Returns `null` when no active filters (accountIds, types, categoryIds, dateFrom, dateTo all empty)
- `flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-b overflow-x-auto scrollbar-none flex-nowrap`
- Chip: `bg-primary/10 text-primary text-xs px-2 py-1 rounded-full`; `X` (11px) remove button
- "Clear all" text button at right (`underline`, 12px)
- Filter types available: `['expense', 'income', 'transfer', 'debt_lent', 'debt_borrowed']`

---

### 10.6 ConfirmDialog

**File:** `src/components/common/ConfirmDialog.tsx`

```typescript
function ConfirmDialog({
  open, title, description?, confirmLabel = 'Delete', onConfirm, onCancel
}: Props)
```

- `max-w-sm` dialog; Cancel (outline) + Delete (destructive) buttons
- Closing via overlay click triggers `onCancel`

---

### 10.7 AmountField / DateInput (TransactionModal internals)

**AmountField:**
```typescript
function AmountField({ value, active, onActivate, placeholder }: {
  value: string; active: boolean; onActivate: () => void; placeholder: string
})
```
- `w-28 shrink-0 text-right border rounded-md cursor-pointer select-none`
- Active: `border-ring ring-2 ring-ring`

**DateInput:**
```typescript
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void })
```
- Shows formatted value `DD.MM.YYYY` (or placeholder) + calendar SVG icon on the right
- Hidden `<input type="date">` positioned `absolute inset-0 opacity-0` overlays the whole div
- `onClick` → `inputRef.current?.showPicker()` (opens native calendar on desktop); falls back to `.focus()` via try/catch
- Shared `DatePicker` component (`src/components/common/DatePicker.tsx`) follows the same pattern and is used in FilterPanel, MonthlyView, and YearlyChart

### 10.8 FilterPanel

**File:** `src/components/common/FilterPanel.tsx`

Full-height filter panel with "Clear all filters" fixed at top (above scrollable filter sections). Uses `DatePicker` for From / To date range. Accounts, types, and categories are chip-based multi-select.

---

## 11. Theme & Colors

All tokens defined in `src/index.css`. Dark mode: `@media (prefers-color-scheme: dark)` — no JavaScript toggle.

| Token | Light (HSL) | Dark (HSL) | Usage |
|---|---|---|---|
| `--background` | `0 0% 100%` (white) | `0 0% 11%` | Page background |
| `--foreground` | `240 10% 10%` | `0 0% 95%` | Body text |
| `--card` | `0 0% 100%` | `0 0% 21%` | Card surfaces |
| `--card-foreground` | `240 10% 10%` | `0 0% 95%` | Card text |
| `--popover` | `0 0% 100%` | `0 0% 14%` | Dropdowns, popovers |
| `--popover-foreground` | `240 10% 10%` | `0 0% 95%` | |
| `--primary` | `25 75% 55%` (orange) | `25 65% 63%` | Buttons, FAB, focus rings |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Text on primary |
| `--secondary` | `25 8% 95%` | `0 0% 21%` | Subtle surfaces |
| `--secondary-foreground` | `240 10% 10%` | `0 0% 95%` | |
| `--muted` | `25 8% 95%` | `0 0% 21%` | Muted surfaces (group headers) |
| `--muted-foreground` | `0 0% 42%` | `0 0% 58%` | Placeholder/secondary text |
| `--accent` | `38 60% 96%` (warm cream) | `0 0% 18%` | Hover/selected states |
| `--accent-foreground` | `25 60% 35%` | `0 0% 95%` | |
| `--destructive` | `0 70% 67%` (red) | `0 55% 58%` | Delete actions |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | |
| `--border` | `0 0% 88%` | `0 0% 29%` | All borders |
| `--input` | `0 0% 88%` | `0 0% 22%` | Input borders |
| `--ring` | `25 75% 55%` (= primary) | `25 65% 63%` | Focus rings |
| `--radius` | `0.5rem` | `0.5rem` | Border radius base |

**Tailwind font sizes override:**
- `text-xs`: 1rem / 1.5rem line-height
- `text-sm`: 1rem / 1.5rem line-height

**PWA accent:** `#e07e38` (`theme_color` and `background_color` in web manifest).

**Named category/account colors** (used in onboarding seed and CSV import):
`#22c55e` Groceries · `#3b82f6` Transport · `#f87171` Health · `#10b981` €Cash · `#06b6d4` Wise · `#8b5cf6` Revolut · `#f59e0b` ₽Cash · `#ef4444` Tinkoff Debit · `#f97316` Tinkoff Save/BigSave · `#6366f1` Tinkoff IIS/Brokerage · `#14b8a6` Trading 212 · `#22c55e` eToro

---

## 12. Navigation

There is no React Router. Navigation state lives entirely in `useUIStore.selectedView`.

| `selectedView` | Component rendered | Entry point |
|---|---|---|
| `'transactions'` | `TransactionList` | Default on load |
| `'accounts'` | `AccountsPage` | Drawer item |
| `'categories'` | `CategoriesPage` | Drawer item |
| `'analytics'` | `AnalyticsPage` | Drawer item |
| (any) + `settingsOpen=true` | `SettingsPage` | Header avatar menu → Settings |
| (any) + `helpOpen=true` | `HelpPage` | Header avatar menu → Help |
| (any) + `feedbackOpen=true` | `FeedbackPage` | Header avatar menu → Feedback |

**No deeplinks.** The app has no URL-based routing; the GitHub Pages URL is always `/Money_PWA/`.

---

## 13. Loading & Empty States

### Loading

| Situation | Indicator |
|---|---|
| Initial app startup (GIS script loading, token check) | Full-page `"Loading..."` text (`text-muted-foreground`) |
| Sync in progress | `RefreshCw` (16px, `animate-spin`) in Header |
| Pending writes (offline) | `WifiOff` icon with tooltip showing count |
| TransactionModal saving | Button text changes to "Saving…", disabled |
| AccountModal saving | Button text "Saving...", `isSubmitting` disabled |

### Empty states

| Screen | Icon | Message |
|---|---|---|
| TransactionList | `Wallet` (40px, opacity-20) | "No transactions yet" + "+ Add transaction" button |
| AccountsPage | `CreditCard` (40px, opacity-20) | "No accounts yet" |
| CategoriesPage | `Tag` (40px, opacity-20) | "No categories yet" |
| CategoryDonut | `BarChart2` (40px, opacity-20) | "No data for this month" |

---

## 14. CI/CD & Build

**Workflow:** `.github/workflows/deploy.yml`

| Step | Details |
|---|---|
| Trigger | Push to `main` branch |
| Runner | `ubuntu-latest` |
| Node version | 20 (with npm cache) |
| Install | `npm ci` |
| Build | `npm run build` (`tsc -b && vite build`) |
| Secrets | `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` (for Picker), `VITE_FEEDBACK_URL` |
| Publish | Official `actions/upload-pages-artifact` + `actions/deploy-pages` |

**Vite build config:**
- `base: '/Money_PWA/'`
- `resolve.alias: '@' → './src'`
- PWA: `registerType: 'autoUpdate'`, manifest `theme_color: '#e07e38'`
- Workbox runtime caching:
  - `sheets.googleapis.com` → `NetworkFirst`, `networkTimeoutSeconds: 10`, cache `sheets-api`
  - `cdn.jsdelivr.net` (fawazahmed0/currency-api) → `NetworkFirst`, `networkTimeoutSeconds: 10`, cache `exchange-rates`
  - `accounts.google.com/gsi` → `NetworkOnly` (auth cannot be cached)

---

## 15. First-Time Setup (New Developer)

1. **Clone** the repository.
2. **Google Cloud Console** → Create a project → Enable *Google Sheets API* and *Google Drive API* → Create an OAuth2 client ID (Web application type) → Add your local dev origin and the GitHub Pages origin (`https://username.github.io`) to Authorized JavaScript origins.
3. **Environment variables:** Create `.env.local` in project root:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=your-api-key          # Cloud project API key (for Google Picker)
   VITE_FEEDBACK_URL=https://...             # optional; feedback form endpoint
   ```
4. **Install:** `npm install`
5. **Run dev server:** `npm run dev` — app served at `http://localhost:5173/Money_PWA/`
6. **First sign-in:** Click "Sign in with Google"; on success the app shows the **SetupScreen** — click "Create new spreadsheet" to create `db_money` and seed starter data, or "Pick existing" to open the Google Picker.
7. **GitHub Actions secrets:** Add `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, and `VITE_FEEDBACK_URL` in repo Settings → Secrets → Actions.

---

## 16. Key Algorithms

### 16.1 Transaction balance delta

```
computeBalanceDelta(t: Transaction):
  expense       → { accountId: t.account_id,  delta: -t.amount }
  income        → { accountId: t.account_id,  delta: +t.amount }
  transfer      → { accountId: t.account_id,  delta: -t.amount,
                    toAccountId: t.to_account_id, toDelta: +t.to_amount }
  debt_lent     → if t.debt_ref_id != '':  { delta: +t.amount }  // repayment received
                  else:                     { delta: -t.amount }  // lent out
  debt_borrowed → if t.debt_ref_id != '':  { delta: -t.amount }  // repayment made
                  else:                     { delta: +t.amount }  // received
```

On **update**: reverse old delta, then apply new delta.  
On **delete**: reverse old delta only.

---

### 16.2 Queue deduplication (flush)

```
Input: items[] sorted by createdAt ASC

latestMap = Map<key, item>
  key = "${entityType}:${entityId}:${operationType}"

For each item:
  existing = latestMap.get(key)
  if !existing OR item.createdAt > existing.createdAt:
    latestMap.set(key, item)

latestIds = Set of localIds from latestMap.values()

// Mark superseded items done (delete from queue without API call)
For each item NOT in latestIds: markDone(item.localId)

// Process latest items
For each item in latestMap.values():
  markProcessing → processQueueItem → markDone (or markFailed)
```

---

### 16.3 Date-group labeling

```
formatGroupLabel(date: string):
  d = parseISO(date)
  if getYear(d) === getYear(new Date()):
    datePart = format(d, 'dd MMM')          // e.g. "14 Jun"
  else:
    datePart = format(d, 'dd MMM yyyy')     // e.g. "14 Jun 2023"
  return datePart + ' · ' + format(d, 'EEEE')  // e.g. "14 Jun · Saturday"
```

---

### 16.4 `generateId(prefix)`

```
return prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
```

e.g. `generateId('txn')` → `txn_a1b2c3d4`

---

### 16.5 `convertToBase(amount, currency, baseCurrency, rates)`

```
if currency === baseCurrency: return amount
rate = rates[currency]
if !rate: return amount          // fallback: assume 1:1
return amount / rate
```

Rates are stored as `{ USD: 1.08, RUB: 95.4, ... }` where each value is `1 baseCurrency = N foreignCurrency`. Division converts *from* foreign *to* base.

---

### 16.6 Multi-category toggle (category grid)

```
toggle(id):
  cur = current category_ids array
  idx = cur.indexOf(id)
  if idx === -1:
    if cur.length < 2: field.onChange([...cur, id])    // append
    else:              field.onChange([cur[0], id])    // replace second
  else:
    field.onChange(cur.filter(c => c !== id))          // deselect
```

Index 0 = primary (analytics, donut chart). Index 1 = secondary tag only.

---

### 16.7 Category delete with transfer

```
deleteCategory(id, transferToId):
  txns = db.transactions.where('category_ids').equals(id).toArray()
  for each txn:
    newIds = txn.category_ids
      .map(cId => cId === id ? transferToId : cId)
      .filter((cId, i, arr) => Boolean(cId) && arr.indexOf(cId) === i)  // dedup
    update txn + enqueue update
  db.categories.delete(id)
```

The `indexOf` deduplication prevents a transaction from having the same category ID twice if both the deleted category and the transfer target were already present.
