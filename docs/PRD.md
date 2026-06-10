# Money PWA — Product Requirements Document

> Version 0.3.0 · Status: Draft · Updated: 2026-06-10

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
16. [Out of Scope (v1)](#16-out-of-scope-v1)

---

## 1. Overview

Money PWA is a personal finance tracker that stores all data in the user's own Google Sheets spreadsheet. The app is built as a Progressive Web App (PWA) hosted on GitHub Pages (no backend — pure static), with full offline support: every write is persisted locally in IndexedDB (via Dexie) and queued for sync. When the device is online the queue is flushed to Google Sheets; on the next open the latest state is pulled back.

**Key design decisions:**

- **Google Sheets as the database.** No proprietary backend. All data lives in a single `db_money` spreadsheet in the user's own Google Drive. Users can read and edit the spreadsheet directly.
- **Offline-first.** Every mutation writes to Dexie first, then enqueues a Sheets operation. The UI reads only from in-memory Zustand state seeded from Dexie. There is no blocking network call on any user action.
- **Last-write-wins conflict resolution.** When pulling from Sheets, `updated_at` timestamps are compared per entity; the newer record wins.
- **No router.** Views are switched by a Zustand `uiStore`. The URL never changes.
- **Persistent session.** The GIS OAuth2 token, expiry timestamp, user profile, and `spreadsheetId` are stored in `localStorage` (key `auth-storage`) via Zustand `persist` middleware. On page reload, `authStore` rehydrates from `localStorage`: if a valid non-expired token is found the user goes directly to the app without any login prompt. Token refresh happens silently. Users must never be forced to re-authenticate on every page load — this is a hard requirement.
- **Visual identity.** Identical tech stack, Tailwind tokens, CSS custom properties, component primitives, and layout conventions as Tasks PWA. Both apps should feel like siblings.

---

## 2. Tech Stack

| Layer | Library | Version | Notes |
|---|---|---|---|
| UI framework | React | ^19 | StrictMode |
| Build tool | Vite | ^7 | `@vitejs/plugin-react` |
| PWA | vite-plugin-pwa | ^1 | Workbox, autoUpdate |
| TypeScript | typescript | ~5.9 | ES2022, strict |
| Styling | Tailwind CSS | ^3 | darkMode: 'media' |
| Tailwind plugin | tailwindcss-animate | ^1 | |
| State | Zustand | ^5 | persist for authStore |
| Local DB | Dexie | ^4 | IndexedDB wrapper |
| Google Sheets | Sheets API v4 | — | direct fetch, no SDK |
| Auth | Google Identity Services | — | `@react-oauth/google` |
| Forms | react-hook-form | ^7 | + zod + @hookform/resolvers |
| DnD | @dnd-kit/core | ^6 | + sortable + utilities (category reorder) |
| Date | date-fns | ^4 | |
| Date picker | react-day-picker | ^9 | |
| Charts | recharts | ^2 | donut + bar charts |
| UI primitives | Radix UI | various | same set as Tasks PWA |
| Icons | lucide-react | ^0.575 | |
| CSS utilities | clsx, tailwind-merge, class-variance-authority | | |
| Exchange rates | frankfurter.app OR exchangerate-api.com | — | frankfurter.app is keyless (preferred for simplicity); exchangerate-api.com free tier if more currencies needed |

---

## 3. Architecture

### Pattern

**Offline-first PWA with Google Sheets as remote storage.** Identical to Tasks PWA.

```
Browser
  │
  ├── React UI (components + Zustand stores)
  │     reads from: in-memory Zustand state
  │     writes via: store actions → Dexie + offlineQueue
  │
  ├── Dexie / IndexedDB  (persistent local cache)
  │
  ├── Offline Queue (Dexie `queue` table)
  │     flushed by syncService.flush()
  │
  └── Google APIs (online only)
        ├── Sheets API v4    — all entity CRUD
        ├── Drive API v3     — spreadsheet search
        └── exchangerate-api — currency rates (read-only, cached)
```

### Data flow

Same write path as Tasks PWA:
1. User action → Zustand store action.
2. `db.[table].put(entity)` — Dexie write (immediate).
3. `enqueue(...)` — queue table.
4. `set({...})` — in-memory update; UI re-renders.
5. `scheduleFlush()` — 800 ms debounce → `syncService.flush()` → Sheets API.

Pull on load / online / every 5 min visibility: `Sheets API GET → upsertMany() → Dexie bulkPut → Zustand set`.

### Balance bookkeeping

Account balances are stored explicitly in `accounts.balance` and updated in the same write that creates/edits/deletes a transaction. They are not computed from history on the fly. Rules:

| Transaction type | Effect on balance |
|---|---|
| `expense` | `account.balance -= amount` |
| `income` | `account.balance += amount` |
| `transfer` | `from_account.balance -= amount`; `to_account.balance += to_amount` |
| `debt_lent` | `account.balance -= amount` (money leaves) |
| `debt_borrowed` | `account.balance += amount` (money arrives) |
| Closing a `debt_lent` | `account.balance += repaid_amount` |
| Closing a `debt_borrowed` | `account.balance -= repaid_amount` |

On edit or delete, the previous effect is reversed before the new one is applied.

### Currency conversion

On app startup (after auth, before `initialLoad`):

1. `fetchExchangeRates()` — GET `https://api.frankfurter.app/latest?from={BASE}` (no API key required). Supported currencies: EUR, USD, RUB, GBP, and others.
2. Rates stored in `exchangeRateStore` (in-memory only; also written to `settings` sheet as a JSON blob for reference).
3. Every new transaction with a non-base currency gets `amount_base = amount * rate` computed at write time and stored permanently. Historical `amount_base` values are never recalculated retroactively.
4. If the fetch fails, a warning banner is shown and the last known rate (from `settings` sheet) is used.

---

## 4. Package / Folder Structure

```
Money-PWA/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.app.json
├── tailwind.config.js
├── .env.example                VITE_GOOGLE_CLIENT_ID (no exchange rate key needed if using frankfurter.app)
├── public/
│   └── icons/
├── docs/
│   ├── PRD.md                  This file
│   ├── ARCHITECTURE.md         Technical architecture and data-flow details
│   └── TASKS.md                Staged implementation task list
└── src/
    ├── main.tsx
    ├── App.tsx                  Auth gate — AppShell vs LoginPage
    ├── index.css                Tailwind + CSS custom properties (same tokens as Tasks PWA)
    ├── types/
    │   ├── transaction.ts       Transaction, TransactionInput, TransactionType
    │   ├── account.ts           Account, AccountInput, AccountType
    │   ├── category.ts          Category, CategoryInput
    │   ├── debt.ts              DebtSummary (derived view type)
    │   ├── sheets.ts            ValueRange, SheetsGetResponse, etc.
    │   └── sync.ts              QueueItem, EntityType, OperationType
    ├── utils/
    │   ├── constants.ts         Sheet names, column indices, ranges
    │   ├── sheetsMapper.ts      row→entity and entity→row for all types
    │   ├── dateUtils.ts         now(), todayISO(), formatDate(), etc.
    │   ├── currencyUtils.ts     formatAmount(), convertToBase()
    │   └── uuid.ts              generateId(prefix)
    ├── services/
    │   ├── db.ts                Dexie schema (MoneyDB)
    │   ├── authService.ts       initAuth(), GIS script loader
    │   ├── syncService.ts       flush(), pull(), initialLoad(), fullSync(), scheduleFlush()
    │   ├── offlineQueue.ts      enqueue(), getPending(), markDone(), markFailed()
    │   └── exchangeRateService.ts fetchExchangeRates(), getCachedRates()
    ├── api/
    │   ├── sheetsClient.ts      sheetsRequest(), findRowIndex(), invalidateRowCache()
    │   ├── spreadsheetSetup.ts  ensureSpreadsheet()
    │   ├── seedOnboarding.ts    writes headers + sample data to new spreadsheet
    │   ├── transactionsApi.ts   fetchAll, append, update, ensureHeader
    │   ├── accountsApi.ts       fetchAll, append, update, ensureHeader
    │   ├── categoriesApi.ts     fetchAll, append, update, ensureHeader
    │   ├── settingsApi.ts       loadSettings(), saveSettings()
    │   └── driveApi.ts          listUserSheets()
    ├── store/
    │   ├── authStore.ts         user, accessToken, tokenExpiry, spreadsheetId
    │   ├── transactionsStore.ts transactions[], addTransaction, updateTransaction, deleteTransaction, upsertMany
    │   ├── accountsStore.ts     accounts[], addAccount, updateAccount, archiveAccount, adjustBalance
    │   ├── categoriesStore.ts   categories[], addCategory, updateCategory, deleteCategory, reorder, upsertMany
    │   ├── exchangeRateStore.ts rates{}, baseCurrency, setRates
    │   ├── prefsStore.ts        baseCurrency, spreadsheetId; saves to settings sheet
    │   ├── syncStore.ts         isSyncing, isOnline, lastSyncAt, pendingCount, syncError
    │   └── uiStore.ts           selectedView, filterState, analyticsMonth
    ├── hooks/
    │   ├── useSync.ts           online/offline/visibilitychange/pagehide handlers
    │   └── useTransactions.ts   useTransactionsByDate, useTransactionsByAccount, useFilteredTransactions
    └── components/
        ├── layout/
        │   ├── AppShell.tsx     Header + drawer nav + main content
        │   ├── LoginPage.tsx
        │   ├── Header.tsx       App bar: hamburger, title, user avatar dropdown (Settings inside)
        │   └── Drawer.tsx       Left nav drawer: Transactions, Accounts, Categories, Analytics
        ├── transactions/
        │   ├── TransactionList.tsx   Grouped by date, with FilterBar
        │   ├── TransactionItem.tsx   Single row: icon, category, account, amount
        │   └── TransactionModal.tsx  Add/edit all transaction types
        ├── accounts/
        │   ├── AccountsPage.tsx     Sections: Cards & Accounts, Savings, Investments, Debts
        │   └── AccountModal.tsx     Add/edit account
        ├── categories/
        │   └── CategoriesPage.tsx   CRUD list with drag-to-reorder, icon/color picker, limits
        ├── analytics/
        │   ├── AnalyticsPage.tsx         Full analytics screen
        │   ├── YearlyChart.tsx           ComposedChart: income/expense bars + balance line, date pickers, period chips
        │   ├── MonthlyView.tsx           Monthly period selector with DatePicker, chips, CategoryDonut
        │   ├── CategoryDonut.tsx         Pie chart with icon labels + category breakdown list
        │   ├── MonthBarChart.tsx         Legacy 12-month expense bar chart (kept for backward compat)
        │   ├── IncomeExpenseChart.tsx    Standalone income vs expense bar chart
        │   ├── BalanceChart.tsx          Standalone balance line chart
        │   └── AnalyticsAccountPicker.tsx  Account filter for YearlyChart balance calculation
        ├── settings/
        │   └── SettingsPage.tsx     Base currency picker, spreadsheet picker
        ├── common/
        │   ├── ConfirmDialog.tsx
        │   ├── SyncStatusBanner.tsx
        │   ├── Toast.tsx
        │   ├── FAB.tsx              Floating action button
        │   ├── CategoryIcon.tsx     Colored icon circle used in lists
        │   ├── FilterBar.tsx        Inline chip row (account, type, category)
        │   ├── FilterPanel.tsx      Full filter panel with DatePicker date range
        │   ├── DatePicker.tsx       Shared DD.MM.YYYY display; showPicker() on desktop
        │   ├── NumericKeyboard.tsx  Custom 1–9 numeric pad for amount entry
        │   ├── IconPicker.tsx       Grid of lucide icons for category selection
        │   └── ColorPicker.tsx      Palette of preset hex colors
```

---

## 5. Data Model

### Transaction

| Field | Type | Description |
|---|---|---|
| id | string | `txn_<8hex>` |
| date | string | `YYYY-MM-DD` |
| type | `'expense' \| 'income' \| 'transfer' \| 'debt_lent' \| 'debt_borrowed'` | |
| amount | number | Positive value in account currency |
| currency | string | 3-letter ISO code (`EUR`, `RUB`, `USD`) |
| amount_base | number | Converted to base currency at write time |
| account_id | string | Source account |
| category_id | string | Required for expense/income; empty for transfer/debt |
| to_account_id | string | Destination account (transfer only) |
| to_amount | number | Amount credited (transfer only; may differ from `amount` for FX) |
| to_currency | string | Destination currency (transfer only) |
| debt_ref_id | string | ID of the original debt transaction being closed; empty otherwise |
| comment | string | Free text; used for debt counterpart name |
| created_at | string | ISO 8601 |
| updated_at | string | ISO 8601 |

**Invariants:**
- `debt_lent` / `debt_borrowed` without a `debt_ref_id` = open debt.
- A closing transaction has `debt_ref_id` pointing to the original, and `type` matching the original.
- Debt transactions do not have a `category_id` and are excluded from analytics.
- Transfer transactions do not have a `category_id` and are excluded from analytics.
- Deleting a transaction reverses its balance effect on the affected account(s).

### Account

| Field | Type | Description |
|---|---|---|
| id | string | `acc_<8hex>` |
| name | string | Display name |
| currency | string | ISO code |
| type | `'card' \| 'cash' \| 'savings' \| 'investment'` | Determines section on Accounts screen |
| balance | number | Current balance (maintained by write path) |
| archived | boolean | Hidden from active pickers if true |
| sort_order | number | Order within type section |

### Category

| Field | Type | Description |
|---|---|---|
| id | string | `cat_<8hex>` |
| name | string | Display name |
| icon | string | lucide-react icon name, e.g. `'ShoppingCart'` |
| color | string | Hex color for icon background, e.g. `'#22c55e'` |
| is_expense | boolean | Appears in expense picker |
| expense_limit | number | Monthly limit in base currency; 0 = no limit |
| is_income | boolean | Appears in income picker |
| income_limit | number | Monthly limit in base currency; 0 = no limit |
| sort_order | number | Order in pickers and analytics |
| created_at | string | ISO 8601 |
| updated_at | string | ISO 8601 |

**Invariants:**
- Deleting a category shows a dialog: "Move transactions to another category". The chosen target category is applied to all transactions with the deleted `category_id` before deletion.
- `sort_order` is read from Sheets row order on first load; drag-and-drop in the UI updates it and writes back.

### Settings (key-value)

| Key | Value description |
|---|---|
| `base_currency` | `'EUR'` / `'USD'` / `'RUB'` |
| `exchange_rates` | JSON `{ EUR:1, RUB:0.0095, ... }` relative to base; updated on each startup |
| `spreadsheet_id` | Google Sheets file ID (also in localStorage) |

---

## 6. Database / Storage Schema

### Google Sheets structure

**Sheet: `transactions`**

| Column | Field |
|---|---|
| A | id |
| B | date |
| C | type |
| D | amount |
| E | currency |
| F | amount_base |
| G | account_id |
| H | category_id |
| I | to_account_id |
| J | to_amount |
| K | to_currency |
| L | debt_ref_id |
| M | comment |
| N | created_at |
| O | updated_at |

**Sheet: `accounts`**

| Column | Field |
|---|---|
| A | id |
| B | name |
| C | currency |
| D | type |
| E | balance |
| F | archived |
| G | sort_order |
| H | created_at |
| I | updated_at |

**Sheet: `categories`**

| Column | Field |
|---|---|
| A | id |
| B | name |
| C | icon |
| D | color |
| E | is_expense |
| F | expense_limit |
| G | is_income |
| H | income_limit |
| I | sort_order |
| J | created_at |
| K | updated_at |

**Sheet: `settings`**

Single cell `A1` contains a JSON blob (same pattern as Tasks PWA `settings!A1`).

### Dexie / IndexedDB schema

```
transactions  ++localId, id, date, type, account_id, category_id, updated_at
accounts      ++localId, id, updated_at
categories    ++localId, id, sort_order, updated_at
queue         ++localId, status, entityType, entityId, createdAt
```

---

## 7. Authentication & First-Launch Setup

Same flow as Tasks PWA:

1. `ensureSpreadsheet()` — searches Drive for `db_money`. If found, use it. If not, create it and call `seedOnboarding()`.
2. `seedOnboarding()` — writes sheet headers and a small set of starter accounts and categories via a single `values:batchUpdate`.
3. `initialLoad()` — `ensureHeader()` all sheets → `flush()` → `pull()`.
4. `usePrefsStore.load()` — reads `settings!A1` and restores base currency and other prefs.
5. `fetchExchangeRates()` — fetches rates; falls back to cached value from settings if network unavailable.

**Seed accounts:**

| Name | Currency | Type | Balance |
|---|---|---|---|
| Cash (€) | EUR | cash | 0 |
| Cash (₽) | RUB | cash | 0 |

**Seed categories (expenses):**

`Groceries`, `Transport`, `Health`

Each with a default icon and color. Users are expected to customise the list immediately.

---

## 8. Synchronization / API Layer

Identical algorithm to Tasks PWA (see Tasks PWA tech-spec §8):

- Write path: Dexie + queue → debounced 800 ms `flush()` → Sheets API.
- Deduplication by `(entityType, entityId, operationType)` keeping the most recent `createdAt`.
- Retry up to 5 times; items with `retryCount >= 5` excluded from `getPending()`.
- Pull: Sheets → `upsertMany()` with `updated_at` conflict resolution → Dexie `bulkPut` → Zustand.
- `useSync` hook: `online` → `fullSync()`; `visibilitychange` (stale > 5 min) → `fullSync()`; `pagehide` → `flush()`.
- 401 → silent token refresh → one retry; second 401 throws.

**Additional for Money:**

When `flush()` processes a `transaction/create`, `transaction/update`, or `transaction/delete` queue item, it must also enqueue an `account/update` for each affected account (with the adjusted balance). The balance update is computed locally from the Dexie record and the reversed/applied transaction delta, so even if the account row has a stale Sheets value, the local Dexie balance is authoritative.

---

## 9. UI Screens

### AppShell layout

`AppShell` renders:
- `Header` (full width, h-14): hamburger, title "Money", user avatar dropdown (→ Settings, Sign out)
- Mobile: Radix `Sheet` drawer, `side="left"`, nav links
- Desktop: `<aside class="hidden md:flex w-60">` with nav links
- Main content: view determined by `uiStore.selectedView`

Settings opens as an overlay (same as Tasks PWA: boolean `settingsOpen` in `uiStore`, back chevron in header).

---

### Transactions (default view)

- **Data:** all transactions sorted by `date` descending, grouped by date. Each group header shows the date and the net daily total.
- **Top bar:** total balance across all non-archived, non-investment accounts in base currency. Filter icon opens `FilterBar`.
- **FilterBar:** Account (multi-select), Type (multi-select: expense/income/transfer/debt), Category (multi-select), Date range (from–to). Same chip-based UI as Tasks PWA filter bar.
- **Each row:** category icon+color circle | category name + account name | amount (red for expense/debt_lent, green for income/debt_borrowed, grey for transfer). Transfer rows show "Account A → Account B".
- **FAB (+):** opens `TransactionModal` in create mode.
- **Tap row:** opens `TransactionModal` in edit mode.
- **Empty state:** `Wallet` icon + "No transactions yet" + "Add transaction" ghost button.

---

### Add / Edit Transaction (`TransactionModal`)

Type selector at top (tabs or segmented control): **Expense · Income · Transfer · Debt**.

**Expense / Income fields:**
- Amount (large numpad or text input) + currency selector (EUR / RUB / USD)
- Category picker (icons grid, filtered by is_expense / is_income)
- Account picker
- Date (defaults to today)
- Comment

**Transfer fields:**
- From account + amount + currency
- To account + to_amount + to_currency (auto-filled = from_amount if same currency)
- Date, Comment

**Debt fields:**
- Subtype: "I lent" / "I borrowed"
- Amount + currency
- Account
- Date, Comment (used for counterpart name)
- If editing an open debt: "Mark as repaid" button → creates a closing transaction with `debt_ref_id`.

---

### Accounts

Sections (grouped by `type`), each collapsible:

- **Cards & Accounts** (`card`) — name, currency symbol, balance
- **Savings** (`savings`) — same
- **Investments** (`investment`) — same; no transactions, balance edited manually
- **Debts** — derived view: open `debt_lent` / `debt_borrowed` transactions grouped by counterpart name (from comment), showing total outstanding per person

FAB (+): opens `AccountModal`.
Tap account row: opens `AccountModal` in edit mode (not transaction list — per design decision).
"Show archived" toggle at bottom.

**`AccountModal` fields:** Name, Currency (selector), Type (selector), Opening balance (for new accounts), Archive toggle (edit mode only).

---

### Categories

Full-screen list of all categories, ordered by `sort_order`. Drag-to-reorder via `@dnd-kit` (same as Tasks PWA folder reorder). Changes to `sort_order` are queued and flushed.

**Each row:** colored icon circle | name | expense chip (with limit if set) | income chip | edit icon.

**Tap row / edit icon:** opens `CategoryModal`.

**`CategoryModal` fields:**
- Icon picker (`IconPicker` component — grid of lucide icons)
- Color picker (`ColorPicker` — preset palette)
- Name
- `[✓] Expense` toggle + limit input (base currency, 0 = none)
- `[✓] Income` toggle + limit input

**Delete:** `ConfirmDialog` → "Move transactions in this category to:" selector → execute reassignment + deletion.

FAB (+): new category.

---

### Analytics

Single scrollable screen split into two sub-views: **YearlyChart** (top) and **MonthlyView** (below).

---

#### YearlyChart

`recharts` `ComposedChart`. Income and expense bars (positive/negative) plus a running balance line for selected accounts.

- **Year navigation** `← 2025 →` — sets full calendar year in the date fields; `year` state tracks current year for header label.
- **Date fields** (always visible) — `DatePicker` for From / To; editing either field sets chip to `custom`.
- **Period chips** — `This year` / `1Y` / `2Y` / `3Y`; each fills date fields relative to today. `RotateCcw` button appears when period differs from default ("This year").
- **Series toggles** — Income / Expenses / Balance (each toggles visibility on the chart).
- **Balance line** — reconstructed backwards from `currentBalance` using `monthlyNet` per month. Only accounts in `analyticsAccountIds` (or all non-archived convertible accounts if none selected) are included. `AnalyticsAccountPicker` (gear icon) lets the user filter which accounts feed the balance line.
- **Bar click** → calls `onMonthClick(month)` which sets `analyticsMonth` and scrolls MonthlyView.

---

#### MonthlyView

- **Month navigation** `← May 2026 →` — updates `analyticsMonth` in `uiStore`.
- **Date fields** (always visible) — `DatePicker` for From / To. Editing either field activates `customMode` and de-highlights chips.
- **Period chips** — `Month` / `3M` / `6M` / `Year`; chips always anchor to the end of `dateTo`, not to `analyticsMonth`, so the selected range is always predictable.
  - `Month` = single calendar month ending at dateTo.
  - `3M` / `6M` = rolling N months ending at dateTo.
  - `Year` = rolling 12 months ending at dateTo.
- **`RotateCcw`** appears next to date fields when the current period differs from the current calendar month.
- **Expenses / Income toggle** — full-width tab bar with totals; income always shown in `text-green-500`.
- **`CategoryDonut`** — passed `dateFrom`, `dateTo`, `isAverage`, `monthCount`, `todayFraction`, `periodLabel`.

---

#### CategoryDonut

- `recharts` `PieChart` with `innerRadius=60`, `outerRadius=90`.
- Segments in `sort_order` order; `paddingAngle=2`; `stroke="none"` (no white sector borders).
- **Icon labels** rendered as pure SVG `<g>` elements (no `foreignObject`) — a colored `<circle>` with a `LucideIcon` nested SVG on top. Labels shown only for segments > 3%.
- SVG viewport: `height=290`, `cy=145` → icon extent [145±133] = [12, 278] ⊂ [0, 290]; 12 px clearance top and bottom.
- **Centre label** — total (or average if `isAverage`) in base currency + period abbreviation.
- **Category list** below — icon | name | amount | limit status; thin progress bar if limit set; `todayFraction` marker on progress bar in single-current-month view.

---

### Settings (overlay)

Two cards, in this order:

1. **Spreadsheet** — same as Tasks PWA: shows name/ID, "Change" opens Drive file picker. **This card appears first**, same as Tasks PWA.
2. **Base currency** — select EUR / USD / RUB. Changing this updates `prefsStore`, saves to `settings!A1`, and re-fetches exchange rates. Does not retroactively recalculate stored `amount_base` values.

---

## 10. Key Components

### TransactionItem

Two-row layout:
- Row 1: category icon circle | category name | amount (right-aligned, colored by type)
- Row 2: account name | date (only in filtered/search views where date grouping is absent)

Tap → edit modal.

### FilterBar

Chip row. Each chip: label + down chevron → bottom sheet or popover with options. Active chips show count badge. "Clear all" appears when any filter is active. Same visual treatment as Tasks PWA FilterBar.

### IconPicker

Grid of curated lucide-react icon names relevant to personal finance (groceries, transport, health, etc.). Search field filters by name. Selected icon highlighted with primary color ring.

### ColorPicker

A fixed grid of ~18 preset swatches — same visual approach as the screenshot from the current app: a few base hues (red, orange, yellow, green, teal, cyan, blue, purple, pink, grey, black) each in two tones (lighter / darker), arranged in rows. No free colour input. Selected swatch has a checkmark overlay. This keeps the UI simple and ensures category colours look good against the app background.

### MonthBarChart

`recharts` `BarChart`. X-axis: abbreviated month names. Y-axis: hidden (space-saving). Bars colored `--primary`. Active/selected bar colored `--primary` at full opacity; others at 40%. Tap interaction sets `analyticsMonth`.

### DatePicker

Shared component used in FilterPanel, MonthlyView, YearlyChart, and TransactionModal.

- Displays date as `DD.MM.YYYY`; hidden `<input type="date">` overlaps the full area at `opacity-0`.
- `onClick` → `inputRef.current?.showPicker()` (desktop native calendar), falls back to `.focus()`.
- Calendar SVG icon always visible on the right.

### CategoryDonut

`recharts` `PieChart` with `innerRadius`. Segments in `sort_order` order, each segment colored by `category.color`. `stroke="none"` removes inter-segment borders. No legend inside chart — icon labels float outside the pie. Centre label: total (or average) for the period. See Analytics §9 for full spec.

### SyncStatusBanner

Identical to Tasks PWA: Offline (amber), Syncing (blue), Error (red + Retry).

---

## 11. Theme & Colors

**Exact same CSS custom properties and Tailwind config as Tasks PWA.** The agent implementing this project must read `docs/tech-spec.md` of Tasks PWA and copy the token definitions verbatim.

Summary:

| Token | Light | Dark |
|---|---|---|
| `--primary` | `25 75% 55%` (~#e07e38) | `25 65% 63%` |
| `--background` | `0 0% 100%` | `0 0% 11%` |
| `--card` | `0 0% 100%` | `0 0% 21%` |
| `--border` | `0 0% 88%` | `0 0% 29%` |
| `--radius` | `0.5rem` | |

PWA theme color: `#e07e38`.

**Amount colors (hardcoded in TransactionItem):**

| Type | Color |
|---|---|
| expense | `#f87171` (red-400) |
| debt_lent | `#f87171` |
| income | `#4ade80` (green-400) |
| debt_borrowed | `#4ade80` |
| transfer | `#9ca3af` (gray-400) |

---

## 12. Navigation

No URL-based router. All navigation via `uiStore`.

```ts
type SelectedView = 'transactions' | 'accounts' | 'categories' | 'analytics'
```

| uiStore flag | Screen |
|---|---|
| `settingsOpen` | SettingsPage (overlay, back chevron) |

Default view: `'transactions'`.

Drawer nav items: Transactions · Accounts · Categories · Analytics.
User avatar dropdown (top-right of Header): Settings · Sign out.

---

## 13. Loading & Empty States

No skeleton animations. Loading shown only via `SyncStatusBanner`.

| View | Icon | Message |
|---|---|---|
| Transactions | `Wallet size=40 opacity-20` | "No transactions yet" |
| Accounts | `CreditCard size=40 opacity-20` | "No accounts yet" |
| Categories | `Tag size=40 opacity-20` | "No categories yet" |
| Analytics (no data) | `BarChart2 size=40 opacity-20` | "No data for this month" |

---

## 14. CI/CD & Build

Hosted on **GitHub Pages**. Deploy `dist/` to `gh-pages` branch via GitHub Actions on push to `main`.

```bash
npm run build   # tsc -b && vite build → dist/
```

`vite.config.ts`: set `base: '/Money-PWA/'` (adjust to actual repo name). Add the GitHub Pages URL (`https://<user>.github.io/Money-PWA`) to Google Cloud Console OAuth authorized origins and redirect URIs.

---

## 15. First-Time Setup (New Developer)

Prerequisites: Node.js ≥ 18, npm ≥ 9, Google account, Google Cloud Console access.

1. Clone and `npm install`.
2. `cp .env.example .env` — fill in `VITE_GOOGLE_CLIENT_ID`. No exchange rate key needed (frankfurter.app is keyless).
3. Google Cloud Console: enable **Sheets API** and **Drive API**. Create OAuth 2.0 Client ID (Web application). Add `http://localhost:5173` to authorized origins and redirect URIs.
4. `npm run dev` → `http://localhost:5173`.
5. First sign-in: `ensureSpreadsheet()` searches Drive for `db_money`. Not found → creates it and runs `seedOnboarding()`.

Available scripts: same as Tasks PWA (`dev`, `build`, `preview`, `lint`).

---

## 16. Out of Scope (v1)

- Recurring / scheduled transactions
- CSV import (separate Python script to be written later)
- Broker API integration (eToro, Trading212)
- Push notifications
- Multi-user / shared budgets
- Receipt scanning / OCR
- Retroactive recalculation of `amount_base` after base currency change
