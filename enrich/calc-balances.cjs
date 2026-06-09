'use strict'
/**
 * Reads accounts.csv + transactions.csv, calculates net balance
 * for each account, writes updated accounts.csv with correct balances.
 */
const fs = require('fs')

function parseCSV(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim())
  const header = lines[0].split(',').map(s => s.trim())
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (const c of line) {
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { vals.push(cur); cur = '' }
      else cur += c
    }
    vals.push(cur)
    const obj = {}
    header.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
    return obj
  })
}

function toCsvLine(row) {
  return row.map(v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}

const accounts     = parseCSV('enrich/accounts.csv')
const transactions = parseCSV('enrich/transactions.csv')

// net[accountId] = running balance from all transactions
const net = {}
for (const acc of accounts) net[acc.id] = 0

for (const t of transactions) {
  const amt = parseFloat(t.amount) || 0

  switch (t.type) {
    case 'expense':
      if (net[t.account_id] !== undefined) net[t.account_id] -= amt
      break
    case 'income':
      if (net[t.account_id] !== undefined) net[t.account_id] += amt
      break
    case 'transfer':
      if (net[t.account_id]    !== undefined) net[t.account_id]    -= amt
      if (net[t.to_account_id] !== undefined) net[t.to_account_id] += parseFloat(t.to_amount) || amt
      break
    case 'debt_lent':
      // debt_ref_id set → repayment coming back (+), else lent (-)
      if (net[t.account_id] !== undefined)
        net[t.account_id] += t.debt_ref_id ? amt : -amt
      break
    case 'debt_borrowed':
      if (net[t.account_id] !== undefined)
        net[t.account_id] += t.debt_ref_id ? -amt : amt
      break
  }
}

console.log('\nCalculated balances:')
for (const acc of accounts) {
  const bal = net[acc.id] ?? 0
  console.log(`  ${acc.name.padEnd(22)} ${acc.currency}  ${bal.toFixed(2)}`)
  acc.balance = bal.toFixed(2)
}

// Write updated accounts.csv
const header = 'id,name,currency,type,balance,archived,sort_order,created_at,updated_at,color'
const rows = accounts.map(a => toCsvLine([
  a.id, a.name, a.currency, a.type, a.balance,
  a.archived, a.sort_order, a.created_at, a.updated_at, a.color || '#6b7280',
]))
fs.writeFileSync('enrich/accounts.csv', [header, ...rows].join('\n'), 'utf8')
console.log('\n✅ enrich/accounts.csv updated with correct balances.')
console.log('   Re-upload only the accounts sheet in Google Sheets.\n')
