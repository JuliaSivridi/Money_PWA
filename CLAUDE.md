# CLAUDE.md — Money PWA

Read this file at the start of every session before writing any code.

---

## Project

Personal finance PWA. Google Sheets as database. Offline-first. Hosted on GitHub Pages.

Full spec: `docs/PRD.md`
Architecture: `docs/ARCHITECTURE.md`
Task list: `docs/TASKS.md`

---

## Visual identity

This app is a sibling of **Tasks PWA**. Both must look identical in typography, spacing, colors, and component style.

- Read Tasks PWA `docs/tech-spec.md` for the exact CSS custom properties and Tailwind config.
- Copy the token definitions verbatim into `src/index.css` and `tailwind.config.js`.
- Icons: **lucide-react** only (same set as Tasks PWA).
- No custom CSS animations beyond `tailwindcss-animate`.
- Dark mode: `prefers-color-scheme: dark` via Tailwind `darkMode: 'media'`.

---

## Code rules

- **TypeScript strict** — no `any`, no `// @ts-ignore`.
- All new files in `src/` must be `.tsx` (components) or `.ts` (everything else).
- Zustand stores: one file per store in `src/store/`.
- Sheets API: all calls go through `src/api/sheetsClient.ts` — never call `fetch` directly from a component or store.
- No business logic in components — components call store actions only.
- `generateId(prefix)` from `src/utils/uuid.ts` for all new entity IDs.
- `now()` and `todayISO()` from `src/utils/dateUtils.ts` — never `new Date()` inline.

---

## Do not

- Do not change CSS custom properties or Tailwind tokens without explicit instruction.
- Do not add npm dependencies without explicit instruction.
- Do not refactor files outside the current task scope.
- Do not delete or rename existing files without explicit instruction.
- Do not write balance logic inline — always use `accountsStore.adjustBalance()`.

---

## How to work with TASKS.md

1. Read `docs/TASKS.md`.
2. Find the first task with status `[ ]`.
3. Implement only that task — nothing more.
4. When done, mark it `[x]` in `docs/TASKS.md`.
5. Report what was done and what files were changed.

---

## Auth requirement (critical)

The user must never be asked to sign in again on page reload. Token + user profile + spreadsheetId are stored in `localStorage` via Zustand `persist`. On load, check token validity silently; only show LoginPage if silent refresh fails. See `docs/ARCHITECTURE.md §4`.

---

## Google Sheets mapping

Every entity has a mapper in `src/utils/sheetsMapper.ts`:
- `rowToX(row: string[])` — converts a Sheets row array to a typed entity.
- `xToRow(entity)` — converts an entity to a row array.

Column order is defined in `src/utils/constants.ts` as index constants (e.g. `TRANSACTION_COLS`). Never hardcode column numbers in API files.
