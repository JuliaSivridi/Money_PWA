# Money PWA — Architecture

> Version 0.2.0 · 2026-06-10

---

## 1. Hosting & Deploy

- **Runtime:** pure static SPA — no server, no serverless functions.
- **Host:** GitHub Pages, deployed from `gh-pages` branch (root).
- **Source branch:** `main`. GitHub Actions workflow builds `dist/` and pushes to `gh-pages` on every push to `main`.
- **Base path:** `vite.config.ts` sets `base: '/Money-PWA/'` (adjust if repo name differs).
- **OAuth origins:** add `https://<user>.github.io/Money-PWA` to Google Cloud Console → OAuth 2.0 Client → Authorized JavaScript origins AND Authorized redirect URIs.

---

## 2. Tech Stack (pinned versions)

Mirrors Tasks PWA exactly. See `PRD.md §2` for the full table.

Key additions over Tasks PWA:
- `recharts ^2` — bar chart + donut chart on Analytics screen.
- `fawazahmed0/currency-api (jsDelivr CDN)` — keyless exchange rate API (no env var needed).

---

## 3. Project Layout

```
Money-PWA/
├── .github/
│   └── workflows/
│       └── deploy.yml          build → gh-pages
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md         (this file)
│   └── TASKS.md
├── public/
│   └── icons/                  PWA icons 192px, 512px
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.app.json
├── CLAUDE.md                   Agent instructions (read on every session)
├── .env.example                VITE_GOOGLE_CLIENT_ID
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/          — TypeScript interfaces
    ├── utils/          — pure helpers (no side effects)
    ├── services/       — Dexie, sync, auth, exchange rates
    ├── api/            — Sheets API calls, Drive, spreadsheet setup
    ├── store/          — Zustand stores
    ├── hooks/          — custom React hooks
    └── components/
        ├── layout/           AppShell, Header, Drawer, LoginPage
        ├── transactions/     TransactionList, TransactionItem, TransactionModal
        ├── accounts/         AccountsPage, AccountModal, AccountsFilterPanel
        ├── categories/       CategoriesPage, CategoryModal, CategoriesFilterPanel
        ├── analytics/        AnalyticsPage, YearlyChart, MonthlyView, CategoryDonut,
        │                     MonthBarChart, IncomeExpenseChart, BalanceChart, AnalyticsAccountPicker
        ├── settings/         SettingsPage
        ├── common/           DatePicker, FilterBar, FilterPanel, NumericKeyboard,
        │                     CategoryIcon, FAB, IconPicker, ColorPicker,
        │                     ConfirmDialog, Toast, SyncStatusBanner
        └── ui/               Radix-backed primitives (Button, Select, Dialog, Sheet, …)
```

---

## 4. Auth & Session

### Sign-in flow

1. `App.tsx` mounts → reads `authStore` from `localStorage` (Zustand `persist`).
2. If `accessToken` exists and `tokenExpiry > now() + 60s` → user is authenticated, skip to step 5.
3. If token is expired but user record exists → call `refreshToken()` silently (GIS `requestAccessToken` with `prompt: ''`). On success → update `accessToken` + `tokenExpiry` in store. On failure → show LoginPage.
4. If no user record → show `LoginPage`. User clicks "Sign in with Google" → GIS token flow with `prompt: 'select_account'`.
5. On successful auth → `ensureSpreadsheet()` → `initialLoad()`.

### What is persisted in localStorage (`auth-storage`)

```ts
{
  user: { email, name, picture },
  accessToken: string,
  tokenExpiry: number,   // unix ms
  spreadsheetId: string,
}
```

**Hard requirement:** the user must never be asked to re-authenticate on page reload as long as the token can be silently refreshed. A visible login prompt only appears when GIS cannot refresh silently (e.g. permissions revoked).

### OAuth scopes

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

`drive.file` gives access only to files created by the app — not the entire Drive.

---

## 5. Data Layer

### Dexie schema (MoneyDB)

```ts
class MoneyDB extends Dexie {
  transactions!: Table<Transaction>
  accounts!:     Table<Account>
  categories!:   Table<Category>
  queue!:        Table<QueueItem>
}

// version 1
db.version(1).stores({
  transactions: '++localId, id, date, type, account_id, category_id, updated_at',
  accounts:     '++localId, id, type, archived, updated_at',
  categories:   '++localId, id, sort_order, updated_at',
  queue:        '++localId, status, entityType, entityId, createdAt',
})
```

### Zustand stores

| Store | Persisted | Contents |
|---|---|---|
| `authStore` | ✅ localStorage | user, accessToken, tokenExpiry, spreadsheetId |
| `transactionsStore` | ❌ | transactions[], CRUD actions, upsertMany |
| `accountsStore` | ❌ | accounts[], CRUD actions, adjustBalance |
| `categoriesStore` | ❌ | categories[], CRUD + reorder, upsertMany |
| `exchangeRateStore` | ❌ | rates{}, baseCurrency |
| `prefsStore` | ❌ (saved to Sheets settings) | baseCurrency |
| `syncStore` | ❌ | isSyncing, isOnline, pendingCount, syncError |
| `uiStore` | ❌ | selectedView, filterState, analyticsMonth |

### Write path (identical to Tasks PWA)

```
User action
    │
    ▼
Zustand store action
    ├── 1. db.[table].put(entity)        Dexie write (sync)
    ├── 2. enqueue(entityType, op, id)   queue table
    ├── 3. set({ ... })                  in-memory → UI re-renders
    └── 4. scheduleFlush()               800ms debounce
                │
                ▼
          syncService.flush()
                ├── dedup by (entityType, entityId, operationType)
                ├── Sheets API write
                └── invalidateRowCache()
```

**Balance updates** are part of the same write: when a transaction is created/edited/deleted, `accountsStore.adjustBalance(accountId, delta)` is called within the same action, which also enqueues an `account/update` for the affected account(s).

### Read path

```
initialLoad()
    ├── ensureHeader() × 3 sheets
    ├── flush()
    └── pull()
          ├── fetch transactions + accounts + categories in parallel
          └── upsertMany() each:
                compare updated_at → keep newer
                Dexie bulkPut → Zustand set
```

---

## 6. Google Sheets API

Direct `fetch` calls — no SDK. All requests go through `sheetsClient.ts`:

```ts
sheetsRequest(method, path, body?)
  // Authorization: Bearer {accessToken}
  // 401 → silent refresh → retry once → throw
```

Row ↔ entity mapping: `sheetsMapper.ts` exports `rowToTransaction`, `transactionToRow`, etc.

Row number cache: `entityId → sheet row index` map, invalidated after every flush.

`ensureHeader(sheetName, headers[])`: reads row 1; if missing or wrong, writes the header row. Called on every `initialLoad`.

---

## 7. Exchange Rates

```
fetchExchangeRates(baseCurrency: string): Promise<Rates>
  GET https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.json
  → { rates: { EUR: 1, RUB: 95.2, USD: 1.08, ... } }
```

- Called once after auth, before `initialLoad`.
- Result stored in `exchangeRateStore` (in-memory).
- Also written to `settings!A1` JSON blob as `exchange_rates` key.
- On fetch failure: read last known rates from `settings!A1`; show `SyncStatusBanner` warning.
- `convertToBase(amount, currency, rates)` used when writing `amount_base` to a new transaction.

---

## 8. Balance Bookkeeping

Account balances are stored explicitly in `accounts.balance`. They are not derived from transaction history.

### Delta rules

| Transaction type | account_id delta | to_account_id delta |
|---|---|---|
| expense | `−amount` | — |
| income | `+amount` | — |
| transfer | `−amount` | `+to_amount` |
| debt_lent | `−amount` | — |
| debt_borrowed | `+amount` | — |
| close debt_lent | `+amount` | — |
| close debt_borrowed | `−amount` | — |

### Edit / delete

Before applying new delta, reverse the previous delta:
1. Load old transaction from Dexie.
2. Apply reverse delta to affected accounts.
3. Apply new delta (or skip if deleting).
4. Enqueue account updates for all affected accounts.

---

## 9. Analytics Calculations

All analytics computed in-memory from `transactionsStore` + `accountsStore`. No pre-aggregation.

### YearlyChart

```ts
// rows: iterate YYYY-MM from dateFrom.slice(0,7) to dateTo.slice(0,7)
// income[month]  = sum amount_base for type==='income'  in that month
// expense[month] = sum amount_base for type==='expense' in that month

// balance reconstruction (walk backwards from currentBalance):
// balAt[nowMonth] = currentBalance
// balAt[m-1] = balAt[m] - monthlyNet[m]

// Only accounts in analyticsAccountIds (or all non-archived+convertible) feed monthlyNet and currentBalance
```

**`AnalyticsAccountPicker`** lets the user choose which accounts are included in the balance line.

### MonthlyView (CategoryDonut)

```ts
// filter: type === txType ('expense' or 'income'), dateFrom <= date <= dateTo
// group by category_ids[0], sum amount_base
// order by category.sort_order
// if isAverage (monthCount > 1): divide totals by monthCount for display
// for each: compare (displayAmount) vs category.expense_limit
```

**Period chips** anchor to the *end* of `dateTo` (not `analyticsMonth`) so selecting a chip always gives a predictable range ending at the currently visible period.

**`todayFraction`** = `today.getDate() / getDaysInMonth(today)` — passed to CategoryDonut only for the single-month view of the current calendar month. Used to render a vertical marker on limit progress bars.

**Base currency display:** all amounts shown in `baseCurrency` using stored `amount_base`.

---

## 10. Navigation

No router. `uiStore.selectedView` drives the main content area.

```ts
type SelectedView = 'transactions' | 'accounts' | 'categories' | 'analytics'
```

Overlay screens (boolean flags in `uiStore`):

| Flag | Screen | Header |
|---|---|---|
| `settingsOpen` | SettingsPage | "Settings" + back chevron |

Drawer nav: Transactions · Accounts · Categories · Analytics.
Header right: user avatar → dropdown → Settings / Sign out.

---

## 11. GitHub Actions Deploy

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

`VITE_GOOGLE_CLIENT_ID` is set as a repository secret in GitHub → Settings → Secrets.
