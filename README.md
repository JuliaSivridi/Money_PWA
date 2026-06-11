# Money

[![Live PWA](https://img.shields.io/badge/Money_PWA-Live_PWA-E07E38?style=for-the-badge)](https://juliasivridi.github.io/Money_PWA/)

![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets_API-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth_2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white)](https://juliasivridi.github.io/Money_PWA/)

A personal finance tracker built as a **Progressive Web App**. Runs in any browser and installs on Android/iOS/desktop as a standalone app. No backend — Google Sheets is the database, IndexedDB is the local cache.

**Live:** [juliasivridi.github.io/Money_PWA](https://juliasivridi.github.io/Money_PWA/)

---

## Features

- **Offline-first** — every write goes to IndexedDB first; an 800 ms debounced queue flushes to Google Sheets when online. The app is fully usable without a connection
- **Four transaction types** — Expense, Income, Transfer (between accounts), and Debt (lent / borrowed), each with category, account, date, and comment
- **Multi-currency** — accounts have their own currency; exchange rates fetched automatically from [fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api) via jsDelivr CDN (no API key needed, includes RUB); each transaction stores both the original amount and the base-currency equivalent
- **Custom numeric keyboard** — no native keyboard for amount entry; a clean 1–9 pad appears inline and works reliably on all mobile browsers
- **Date picker** — DD.MM.YYYY display with native calendar popup via `showPicker()` on desktop; calendar icon always visible
- **Accounts** — card, cash, savings, investment; opening balance; archive support; live balances updated immediately on every transaction; archived accounts still shown for historical transfers
- **Categories** — custom icon (from Lucide set) and color; monthly budget limits with progress bars and ✓/✗ status
- **Analytics — Yearly view** — income/expense bar chart with balance line; date range pickers + period chips (This year / 1Y / 2Y / 3Y); account filter for the balance calculation; tap a month to jump to monthly detail
- **Analytics — Monthly view** — month navigation + date pickers + period chips (Month / 3M / 6M / Year); category donut with icon labels around the pie; per-category progress bars with today marker; income/expense toggle; average mode for multi-month periods
- **Filters** — filter transactions by account, type, category, and date range
- **Settings** — switch between any spreadsheet in your Google Drive; change base currency; sign out
- **Light / dark theme** — follows OS preference automatically
- **PWA** — installable on Android, iOS, and desktop; works as a standalone app with its own icon

---

## Tech Stack

| Layer | Technology |
|---|---|
| ⚛️ Framework | React 19 + TypeScript 5 (strict) |
| ⚡ Build | Vite 7 + vite-plugin-pwa (Workbox) |
| 🎨 Styling | Tailwind CSS 3 + Radix UI primitives |
| 🗄️ Remote storage | Google Sheets API v4 |
| 💾 Local storage | Dexie 4 (IndexedDB) |
| 🔄 State | Zustand 5 (persist for auth) |
| 🔐 Auth | Google Identity Services (OAuth 2.0) |
| 📋 Forms | react-hook-form + Zod |
| 📊 Charts | Recharts |
| 📅 Dates | date-fns |
| 💱 Exchange rates | fawazahmed0/currency-api via jsDelivr (keyless) |
| 🚀 Hosting | GitHub Pages (via GitHub Actions) |

---

## Setup

### Prerequisites

- Google account
- Google Cloud project with **Google Sheets API v4** and **Google Drive API** enabled
- OAuth 2.0 Client ID (type: Web application)
- Node.js ≥ 18

### Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Sheets API v4** and **Google Drive API**
3. Create an **OAuth 2.0 Client ID** → type: Web application
4. Add to **Authorized JavaScript origins** (not Redirect URIs):
   ```
   http://localhost:5173
   https://your-username.github.io
   ```
5. Add your Google account as a **test user** in the OAuth consent screen

### Local Development

```bash
git clone https://github.com/JuliaSivridi/Money_PWA.git
cd Money_PWA
npm install
```

Create `.env.local` in the project root:
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

```bash
npm run dev    # http://localhost:5173/Money_PWA/
npm run build  # production build → dist/
```

### Deploy to GitHub Pages

1. Add repository secret in **Settings → Secrets and variables → Actions**:
   - `VITE_GOOGLE_CLIENT_ID`
2. Set **Pages source** to **GitHub Actions** (Settings → Pages)
3. Every push to `main` triggers automatic build and deployment

---

## Data Model

All data lives in the user's **db_money** Google Spreadsheet, found or created automatically on first login. Each entity type has its own sheet tab.

### Transactions

| Col | Field | Description |
|-----|-------|-------------|
| A | id | UUID (`txn_…`) |
| B | date | ISO 8601 date (`YYYY-MM-DD`) |
| C | type | `expense` / `income` / `transfer` / `debt_lent` / `debt_borrowed` |
| D | amount | Amount in transaction currency |
| E | currency | ISO 4217 code (`EUR`, `USD`, `RUB`, …) |
| F | amount_base | Amount converted to base currency at time of entry |
| G | account_id | Source account id |
| H | category_id | Category id (empty for transfers/debts) |
| I | to_account_id | Destination account id (transfers only) |
| J | to_amount | Amount received in destination currency (transfers only) |
| K | to_currency | Destination currency (transfers only) |
| L | debt_ref_id | Id of the original debt transaction (repayment link) |
| M | comment | Free-text note |
| N | created_at | ISO 8601 timestamp |
| O | updated_at | ISO 8601 timestamp (used for last-write-wins sync) |

### Accounts

| Col | Field | Description |
|-----|-------|-------------|
| A | id | UUID (`acc_…`) |
| B | name | Display name |
| C | currency | ISO 4217 code |
| D | type | `card` / `cash` / `savings` / `investment` |
| E | balance | Current balance (updated on every transaction) |
| F | archived | `TRUE` / `FALSE` |
| G | sort_order | Integer for manual ordering |
| H | created_at | ISO 8601 timestamp |
| I | updated_at | ISO 8601 timestamp |

### Categories

| Col | Field | Description |
|-----|-------|-------------|
| A | id | UUID (`cat_…`) |
| B | name | Display name |
| C | icon | Lucide icon name |
| D | color | Hex color (`#rrggbb`) |
| E | is_expense | `TRUE` / `FALSE` |
| F | is_income | `TRUE` / `FALSE` |
| G | expense_limit | Monthly limit (0 = none) |
| H | income_limit | Monthly limit (0 = none) |
| I | sort_order | Integer for manual ordering |
| J | created_at | ISO 8601 timestamp |
| K | updated_at | ISO 8601 timestamp |

---

## Install as Mobile / Desktop App

**Android:** Chrome prompts automatically, or use the browser menu → *Install app*

**iOS:** Safari → Share button → *Add to Home Screen*

**Desktop:** address bar → install icon (Chrome / Edge)

---

## Documentation

- **Product requirements:** [`docs/PRD.md`](docs/PRD.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Technical specification:** [`docs/tech-spec.md`](docs/tech-spec.md)

