/**
 * Migration: ZenMoney backup → Money PWA import CSVs
 *
 * Output:
 *   enrich/accounts.csv      — 12 accounts
 *   enrich/categories.csv    — 28 categories
 *   enrich/transactions.csv  — all transactions from 2022-01-01
 */

'use strict'
const fs = require('fs')
const { createHash } = require('crypto')

// ── helpers ──────────────────────────────────────────────────────────────────

/** Deterministic short ID so re-runs produce identical files */
function makeId(prefix, seed) {
  return prefix + '_' + createHash('md5').update(seed).digest('hex').slice(0, 12)
}

function parseAmount(s) {
  if (!s) return 0
  return parseFloat(s.replace(',', '.')) || 0
}

function parseCSVLine(line) {
  const result = []; let cur = '', inQ = false
  for (const c of line) {
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur)
  return result.map(s => s.trim())
}

function csvField(v) {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsvLine(row) { return row.map(csvField).join(',') }

function zenDateToISO(s) {
  // "2022-03-15 14:30:00" → "2022-03-15T14:30:00.000Z"
  return s.replace(' ', 'T') + '.000Z'
}

// ── accounts ─────────────────────────────────────────────────────────────────

const NOW = '2026-06-09T12:00:00.000Z'

const ACCOUNT_DEFS = [
  { zen: '€ S-Pankki',        name: 'S-Pankki',         currency: 'EUR', type: 'card'       },
  { zen: '€ Wise',            name: 'Wise',              currency: 'EUR', type: 'card'       },
  { zen: '€ Cash',            name: '€ Cash',            currency: 'EUR', type: 'cash'       },
  { zen: '€ Revolut',         name: 'Revolut',           currency: 'EUR', type: 'card'       },
  { zen: '₽ Tinkoff Debit',   name: 'Tinkoff Debit',    currency: 'RUB', type: 'card'       },
  { zen: '₽ Tinkoff BigSave', name: 'Tinkoff BigSave',  currency: 'RUB', type: 'savings'    },
  { zen: '₽ Tinkoff Save',    name: 'Tinkoff Save',     currency: 'RUB', type: 'savings'    },
  { zen: '₽ Cash',            name: '₽ Cash',            currency: 'RUB', type: 'cash'       },
  { zen: 'Tinkoff Brokerage', name: 'Tinkoff Brokerage', currency: 'RUB', type: 'investment' },
  { zen: 'Tinkoff IIS',       name: 'Tinkoff IIS',       currency: 'RUB', type: 'investment' },
  { zen: 'Trading 212',       name: 'Trading 212',       currency: 'EUR', type: 'investment' },
  { zen: 'eToro',             name: 'eToro',             currency: 'USD', type: 'investment' },
]

/** zen display name → account row object */
const ACC_BY_ZEN = {}
for (let i = 0; i < ACCOUNT_DEFS.length; i++) {
  const d = ACCOUNT_DEFS[i]
  ACC_BY_ZEN[d.zen] = {
    id: makeId('acc', d.zen),
    name: d.name, currency: d.currency, type: d.type,
    balance: '0', archived: 'FALSE',
    sort_order: String(i + 1),
    created_at: NOW, updated_at: NOW,
  }
}

const IMPORTED = new Set(Object.keys(ACC_BY_ZEN))
const SKIP = new Set([
  '$ Binance', '$ Tinkoff Debit', 'Halva',
  'Tinkoff $ Deposit', 'Tinkoff Saving', '₽ Tinkoff Deposit', 'Долги',
])

// ── categories ───────────────────────────────────────────────────────────────

const CAT_DEFS = [
  // expenses
  { key: 'grocery',    name: 'Grocery',      icon: 'ShoppingCart', color: '#22c55e', exp: true,  inc: false },
  { key: 'cafe',       name: 'Cafe',         icon: 'Coffee',       color: '#f97316', exp: true,  inc: false },
  { key: 'alcohol',    name: 'Alcohol',      icon: 'Wine',         color: '#a855f7', exp: true,  inc: false },
  { key: 'transport',  name: 'Transport',    icon: 'Bus',          color: '#3b82f6', exp: true,  inc: false },
  { key: 'bensin',     name: 'Bensin',       icon: 'Fuel',         color: '#f59e0b', exp: true,  inc: false },
  { key: 'autorepair', name: 'Auto repair',  icon: 'Wrench',       color: '#6b7280', exp: true,  inc: false },
  { key: 'apartment',  name: 'Apartment',    icon: 'Home',         color: '#14b8a6', exp: true,  inc: false },
  { key: 'connection', name: 'Connection',   icon: 'Wifi',         color: '#6366f1', exp: true,  inc: false },
  { key: 'renovation', name: 'Renovation',   icon: 'HardHat',      color: '#f97316', exp: true,  inc: false },
  { key: 'clothes',    name: 'Clothes',      icon: 'Shirt',        color: '#ec4899', exp: true,  inc: false },
  { key: 'health',     name: 'Health',       icon: 'Heart',        color: '#ef4444', exp: true,  inc: false },
  { key: 'pharmacy',   name: 'Pharmacy',     icon: 'Pill',         color: '#84cc16', exp: true,  inc: false },
  { key: 'sport',      name: 'Sport',        icon: 'Dumbbell',     color: '#0ea5e9', exp: true,  inc: false },
  { key: 'haircut',    name: 'Haircut',      icon: 'Scissors',     color: '#d946ef', exp: true,  inc: false },
  { key: 'stuff',      name: 'Stuff',        icon: 'Package',      color: '#9ca3af', exp: true,  inc: false },
  { key: 'electronics',name: 'Electronics',  icon: 'Monitor',      color: '#1d4ed8', exp: true,  inc: false },
  { key: 'presents',   name: 'Presents',     icon: 'Gift',         color: '#f43f5e', exp: true,  inc: false },
  { key: 'hobby',      name: 'Hobby',        icon: 'Palette',      color: '#8b5cf6', exp: true,  inc: false },
  { key: 'recreation', name: 'Recreation',   icon: 'Sun',          color: '#eab308', exp: true,  inc: false },
  { key: 'insurance',  name: 'Insurance',    icon: 'Shield',       color: '#0369a1', exp: true,  inc: false },
  { key: 'lottery',    name: 'Lottery',      icon: 'Ticket',       color: '#ca8a04', exp: true,  inc: false },
  { key: 'study',      name: 'Study',        icon: 'BookOpen',     color: '#7c3aed', exp: true,  inc: false },
  // context tags
  { key: 'child',      name: 'Child',        icon: 'Baby',         color: '#f9a8d4', exp: true,  inc: false },
  { key: 'cat',        name: 'Cat',          icon: 'Cat',          color: '#fbbf24', exp: true,  inc: false },
  // income
  { key: 'salary',     name: 'Salary',       icon: 'Briefcase',    color: '#16a34a', exp: false, inc: true  },
  { key: 'profits',    name: 'Profits',      icon: 'TrendingUp',   color: '#059669', exp: false, inc: true  },
  { key: 'cashback',   name: 'Cashback',     icon: 'Percent',      color: '#10b981', exp: false, inc: true  },
  // both
  { key: 'taxes',      name: 'Taxes/Refunds',icon: 'FileText',     color: '#dc2626', exp: true,  inc: true  },
]

const CAT_BY_KEY = {}
for (let i = 0; i < CAT_DEFS.length; i++) {
  const d = CAT_DEFS[i]
  CAT_BY_KEY[d.key] = {
    id: makeId('cat', d.key),
    name: d.name, icon: d.icon, color: d.color,
    is_expense: d.exp ? 'TRUE' : 'FALSE', expense_limit: '0',
    is_income: d.inc ? 'TRUE' : 'FALSE',  income_limit: '0',
    sort_order: String(i + 1),
    created_at: NOW, updated_at: NOW,
  }
}

/** ZenMoney category string → array of our category keys (max 2) */
const ZEN_CAT_MAP = {
  'Food & Drink / Groceries':                     ['grocery'],
  'Food & Drink / Cafe':                          ['cafe'],
  'Food & Drink / Alcohol':                       ['alcohol'],
  'Payments / Transport':                         ['transport'],
  'Auto / Bensin':                                ['bensin'],
  'Auto / Repair':                                ['autorepair'],
  'Payments / Apartment':                         ['apartment'],
  'Payments / Connection':                        ['connection'],
  'Payments / Renovation':                        ['renovation'],
  'Body / Clothes':                               ['clothes'],
  'Body / Health':                                ['health'],
  'Body / Pharmacy':                              ['pharmacy'],
  'Body / Sport':                                 ['sport'],
  'Things / Stuff':                               ['stuff'],
  'Things / Electronics':                         ['electronics'],
  'Things / Presents':                            ['presents'],
  'Life / Hobby':                                 ['hobby'],
  'Life / Recreation':                            ['recreation'],
  'Finances / Insurance':                         ['insurance'],
  'Finances / Lottery':                           ['lottery'],
  'Finances / Salary':                            ['salary'],
  'Finances / Profits':                           ['profits'],
  'Finances / Cashback':                          ['cashback'],
  'Finances / Taxes- / +Refunds':                 ['taxes'],
  // combos
  'Food & Drink / Groceries, Life / Cat':         ['grocery', 'cat'],
  'Body / Clothes, Life / Child':                 ['clothes', 'child'],
  'Body / Pharmacy, Life / Child':                ['pharmacy', 'child'],
  'Payments / Apartment, Life / Child':           ['apartment', 'child'],
  'Payments / Transport, Life / Child':           ['transport', 'child'],
  'Things / Stuff, Life / Child':                 ['stuff', 'child'],
  'Things / Electronics, Life / Child':           ['electronics', 'child'],
  'Things / Presents, Life / Child':              ['presents', 'child'],
}

// ── process transactions ──────────────────────────────────────────────────────

const rawLines = fs.readFileSync('enrich/backup-zen_20260609.csv', 'utf8')
  .split('\n').slice(4).filter(l => l.trim())

const transactions = []
const warnings = []
let seq = 0

for (const line of rawLines) {
  const r = parseCSVLine(line)
  if (r.length < 10) continue

  const date    = r[0]
  if (date < '2022-01-01') continue

  const catStr  = r[1]
  const comment = r[3]
  const outAcc  = r[4]
  const outAmt  = parseAmount(r[5])
  const outCur  = r[6]
  const inAcc   = r[7]
  const inAmt   = parseAmount(r[8])
  const inCur   = r[9]
  const createdAt = r[10] ? zenDateToISO(r[10]) : NOW
  const updatedAt = r[11] ? zenDateToISO(r[11]) : NOW

  // Skip Долги entirely
  if (outAcc === 'Долги' || inAcc === 'Долги') continue

  const outImported = IMPORTED.has(outAcc)
  const inImported  = IMPORTED.has(inAcc)
  const outSkip     = SKIP.has(outAcc)
  const inSkip      = SKIP.has(inAcc)

  // Resolve category_ids
  const keys = ZEN_CAT_MAP[catStr] || []
  const catIds = keys.map(k => CAT_BY_KEY[k]?.id).filter(Boolean)

  if (!outImported && !inImported) continue // both sides irrelevant

  seq++
  const id = makeId('txn', `${date}-${seq}`)

  // amount_base: EUR = 1:1, others = 0 (no historical rate data)
  const amountBase = (amt, cur) => cur === 'EUR' ? String(amt) : '0'

  if (outImported && inImported) {
    // ── Transfer between two imported accounts ──
    const fromAcc = ACC_BY_ZEN[outAcc]
    const toAcc   = ACC_BY_ZEN[inAcc]
    transactions.push([
      id, date, 'transfer',
      String(outAmt), outCur, amountBase(outAmt, outCur),
      fromAcc.id, catIds.join(','), toAcc.id,
      String(inAmt), inCur,
      '', comment, createdAt, updatedAt,
    ])

  } else if (outImported && (inSkip || !inAcc)) {
    // ── Expense: money left imported account (to skip account or nowhere) ──
    const acc = ACC_BY_ZEN[outAcc]
    const note = inAcc && inSkip
      ? (comment ? `${comment} [→ ${inAcc}]` : `→ ${inAcc}`)
      : comment
    transactions.push([
      id, date, 'expense',
      String(outAmt), outCur, amountBase(outAmt, outCur),
      acc.id, catIds.join(','), '', '0', '',
      '', note, createdAt, updatedAt,
    ])

  } else if (inImported && (outSkip || !outAcc)) {
    // ── Income: money arrived to imported account (from skip account or nowhere) ──
    const acc = ACC_BY_ZEN[inAcc]
    const note = outAcc && outSkip
      ? (comment ? `${comment} [← ${outAcc}]` : `← ${outAcc}`)
      : comment
    transactions.push([
      id, date, 'income',
      String(inAmt), inCur, amountBase(inAmt, inCur),
      acc.id, catIds.join(','), '', '0', '',
      '', note, createdAt, updatedAt,
    ])

  } else {
    // Edge case: one imported, other is neither imported nor skip → warn
    warnings.push(`Skipped: ${date} | out:${outAcc} | in:${inAcc}`)
  }
}

// ── write output ─────────────────────────────────────────────────────────────

const accHeader = 'id,name,currency,type,balance,archived,sort_order,created_at,updated_at'
const accRows = Object.values(ACC_BY_ZEN).map(a =>
  toCsvLine([a.id, a.name, a.currency, a.type, a.balance, a.archived, a.sort_order, a.created_at, a.updated_at])
)
fs.writeFileSync('enrich/accounts.csv', [accHeader, ...accRows].join('\n'), 'utf8')

const catHeader = 'id,name,icon,color,is_expense,expense_limit,is_income,income_limit,sort_order,created_at,updated_at'
const catRows = Object.values(CAT_BY_KEY).map(c =>
  toCsvLine([c.id, c.name, c.icon, c.color, c.is_expense, c.expense_limit, c.is_income, c.income_limit, c.sort_order, c.created_at, c.updated_at])
)
fs.writeFileSync('enrich/categories.csv', [catHeader, ...catRows].join('\n'), 'utf8')

const txnHeader = 'id,date,type,amount,currency,amount_base,account_id,category_ids,to_account_id,to_amount,to_currency,debt_ref_id,comment,created_at,updated_at'
const txnRows = transactions.map(t => toCsvLine(t))
fs.writeFileSync('enrich/transactions.csv', [txnHeader, ...txnRows].join('\n'), 'utf8')

// ── summary ───────────────────────────────────────────────────────────────────
console.log(`\n✅ Done!`)
console.log(`   accounts:     ${accRows.length}`)
console.log(`   categories:   ${catRows.length}`)
console.log(`   transactions: ${txnRows.length}`)

const byType = transactions.reduce((m, t) => { m[t[2]] = (m[t[2]] || 0) + 1; return m }, {})
console.log(`   breakdown:   `, byType)

if (warnings.length) {
  console.log(`\n⚠️  Skipped (edge cases):`)
  warnings.forEach(w => console.log('  ', w))
}

// Unmapped ZenMoney categories
const rawCats = new Set()
for (const line of rawLines) {
  const r = parseCSVLine(line)
  if (r[0] >= '2022-01-01' && r[1]) rawCats.add(r[1])
}
const unmapped = [...rawCats].filter(c => !ZEN_CAT_MAP[c] && c !== '')
if (unmapped.length) {
  console.log(`\n⚠️  Unmapped categories (will have no category_ids):`)
  unmapped.forEach(c => console.log('  ', c))
}
