'use strict'
const fs = require('fs')
const { createHash } = require('crypto')

function makeId(prefix, seed) {
  return prefix + '_' + createHash('md5').update(seed).digest('hex').slice(0, 12)
}

function parseCSV(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim())
  const header = lines[0].split(',').map(s => s.trim())
  return { header, rows: lines.slice(1).map(line => {
    const vals = []; let cur = '', inQ = false
    for (const c of line) {
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { vals.push(cur); cur = '' }
      else cur += c
    }
    vals.push(cur)
    const obj = {}
    header.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
    return obj
  })}
}

function toCsvLine(row) {
  return row.map(v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}

const NOW = '2021-12-31T23:59:59.000Z'

// ── Real balances provided by user ───────────────────────────────────────────
const REAL = {
  '€ Cash':            { real: 68.60,      currency: 'EUR' },
  'S-Pankki':          { real: 850.89,     currency: 'EUR' },
  '₽ Cash':            { real: 2165.00,    currency: 'RUB' },
  'Tinkoff Debit':     { real: 18268.30,   currency: 'RUB' },
  'Tinkoff IIS':       { real: 19000.00,   currency: 'RUB' },
  'Tinkoff Brokerage': { real: 900000.00,  currency: 'RUB' },
  // already correct — skip:
  // Wise, Revolut, Tinkoff Save, Tinkoff BigSave, Trading 212, eToro
}

// ── Load current accounts + transactions ─────────────────────────────────────
const { rows: accounts } = parseCSV('enrich/accounts.csv')
const { rows: transactions } = parseCSV('enrich/transactions.csv')

// Build name→account map
const accByName = {}
for (const a of accounts) accByName[a.name] = a

// Recalculate running balance per account (same logic as calc-balances.cjs)
const net = {}
for (const a of accounts) net[a.id] = 0
for (const t of transactions) {
  const amt = parseFloat(t.amount) || 0
  switch (t.type) {
    case 'expense':  if (net[t.account_id]    !== undefined) net[t.account_id]    -= amt; break
    case 'income':   if (net[t.account_id]    !== undefined) net[t.account_id]    += amt; break
    case 'transfer':
      if (net[t.account_id]    !== undefined) net[t.account_id]    -= amt
      if (net[t.to_account_id] !== undefined) net[t.to_account_id] += parseFloat(t.to_amount) || amt
      break
    case 'debt_lent':     if (net[t.account_id] !== undefined) net[t.account_id] += t.debt_ref_id ? amt : -amt; break
    case 'debt_borrowed': if (net[t.account_id] !== undefined) net[t.account_id] += t.debt_ref_id ? -amt : amt; break
  }
}

// ── Generate corrections ──────────────────────────────────────────────────────
const corrections = []
console.log('\nCorrection transactions (date: 2021-12-31):')

for (const [name, { real, currency }] of Object.entries(REAL)) {
  const acc = accByName[name]
  if (!acc) { console.log(`  ⚠️  Account not found: ${name}`); continue }

  const calculated = net[acc.id] ?? 0
  const diff = parseFloat((real - calculated).toFixed(2))
  if (Math.abs(diff) < 0.005) { console.log(`  ${name.padEnd(22)} ✓ no correction needed`); continue }

  const type = diff > 0 ? 'income' : 'expense'
  const amount = Math.abs(diff)
  const id = makeId('txn', `correction-${acc.id}`)

  console.log(`  ${name.padEnd(22)} calc=${calculated.toFixed(2)} real=${real} diff=${diff > 0 ? '+' : ''}${diff} → ${type} ${amount} ${currency}`)

  corrections.push([
    id, '2021-12-31', '00:00', type,
    amount.toFixed(2), currency, currency === 'EUR' ? amount.toFixed(2) : String(Math.round(amount / 88 * 100) / 100),
    acc.id, '', '', '0', '',
    '', 'Opening balance correction', NOW, NOW,
  ])

  // Update account balance to real value
  acc.balance = real.toFixed(2)
}

// ── Set balance for accounts NOT in REAL map = net from transactions ──────────
console.log('\nNet balances (no correction needed):')
for (const a of accounts) {
  if (REAL[a.name] !== undefined) continue  // already handled above
  const calculated = Math.round((net[a.id] ?? 0) * 100) / 100
  a.balance = calculated.toFixed(2)
  console.log(`  ${a.name.padEnd(22)} net=${a.balance}`)
}

if (corrections.length === 0) {
  console.log('\n  (No correction transactions needed)')
}

// ── Append corrections to transactions.csv ───────────────────────────────────
const txnHeader = 'id,date,time,type,amount,currency,amount_base,account_id,category_ids,to_account_id,to_amount,to_currency,debt_ref_id,comment,created_at,updated_at'
const { rows: existingTxns } = parseCSV('enrich/transactions.csv')

// Remove any previous corrections to avoid duplicates on re-run
const filtered = existingTxns.filter(t => t.comment !== 'Opening balance correction')
const allTxns = [...filtered, ...corrections.map(c => {
  const obj = {}
  const keys = txnHeader.split(',')
  keys.forEach((k, i) => { obj[k] = c[i] })
  return obj
})]

// Sort by date
allTxns.sort((a, b) => a.date < b.date ? -1 : 1)

const txnLines = allTxns.map(t => toCsvLine([
  t.id, t.date, t.time || '00:00', t.type, t.amount, t.currency, t.amount_base,
  t.account_id, t.category_ids, t.to_account_id, t.to_amount, t.to_currency,
  t.debt_ref_id, t.comment, t.created_at, t.updated_at,
]))
fs.writeFileSync('enrich/transactions.csv', [txnHeader, ...txnLines].join('\n'), 'utf8')

// ── Update accounts.csv with real balances ────────────────────────────────────
const accHeader = 'id,name,currency,type,balance,archived,sort_order,created_at,updated_at,color'
const accLines = accounts.map(a => toCsvLine([
  a.id, a.name, a.currency, a.type, a.balance,
  a.archived, a.sort_order, a.created_at, a.updated_at, a.color || '#6b7280',
]))
fs.writeFileSync('enrich/accounts.csv', [accHeader, ...accLines].join('\n'), 'utf8')

console.log(`\n✅ Added ${corrections.length} correction transactions to transactions.csv`)
console.log('✅ Updated accounts.csv with real balances')
console.log('\n📋 Next: re-upload both sheets in Google Sheets (replace all data)')
