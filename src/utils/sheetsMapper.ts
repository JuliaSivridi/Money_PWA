import type { Transaction, TransactionType } from '@/types/transaction'
import type { Account, AccountType } from '@/types/account'
import type { Category } from '@/types/category'
import { TRANSACTION_COLS, ACCOUNT_COLS, CATEGORY_COLS } from './constants'

function cell(row: string[], idx: number): string {
  return row[idx] ?? ''
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export function rowToTransaction(row: string[]): Transaction {
  return {
    id:            cell(row, TRANSACTION_COLS.ID),
    date:          cell(row, TRANSACTION_COLS.DATE),
    type:          (cell(row, TRANSACTION_COLS.TYPE) || 'expense') as TransactionType,
    amount:        Number(cell(row, TRANSACTION_COLS.AMOUNT)) || 0,
    currency:      cell(row, TRANSACTION_COLS.CURRENCY) || 'EUR',
    amount_base:   Number(cell(row, TRANSACTION_COLS.AMOUNT_BASE)) || 0,
    account_id:    cell(row, TRANSACTION_COLS.ACCOUNT_ID),
    category_ids:  cell(row, TRANSACTION_COLS.CATEGORY_IDS).split(',').map(s => s.trim()).filter(Boolean),
    to_account_id: cell(row, TRANSACTION_COLS.TO_ACCOUNT_ID),
    to_amount:     Number(cell(row, TRANSACTION_COLS.TO_AMOUNT)) || 0,
    to_currency:   cell(row, TRANSACTION_COLS.TO_CURRENCY),
    debt_ref_id:   cell(row, TRANSACTION_COLS.DEBT_REF_ID),
    comment:       cell(row, TRANSACTION_COLS.COMMENT),
    created_at:    cell(row, TRANSACTION_COLS.CREATED_AT),
    updated_at:    cell(row, TRANSACTION_COLS.UPDATED_AT),
  }
}

export function transactionToRow(t: Transaction): string[] {
  const row = new Array(15).fill('')
  row[TRANSACTION_COLS.ID]            = t.id
  row[TRANSACTION_COLS.DATE]          = t.date
  row[TRANSACTION_COLS.TYPE]          = t.type
  row[TRANSACTION_COLS.AMOUNT]        = String(t.amount)
  row[TRANSACTION_COLS.CURRENCY]      = t.currency
  row[TRANSACTION_COLS.AMOUNT_BASE]   = String(t.amount_base)
  row[TRANSACTION_COLS.ACCOUNT_ID]    = t.account_id
  row[TRANSACTION_COLS.CATEGORY_IDS]  = t.category_ids.join(',')
  row[TRANSACTION_COLS.TO_ACCOUNT_ID] = t.to_account_id
  row[TRANSACTION_COLS.TO_AMOUNT]     = String(t.to_amount)
  row[TRANSACTION_COLS.TO_CURRENCY]   = t.to_currency
  row[TRANSACTION_COLS.DEBT_REF_ID]   = t.debt_ref_id
  row[TRANSACTION_COLS.COMMENT]       = t.comment
  row[TRANSACTION_COLS.CREATED_AT]    = t.created_at
  row[TRANSACTION_COLS.UPDATED_AT]    = t.updated_at
  return row
}

// ─── Account ─────────────────────────────────────────────────────────────────

export function rowToAccount(row: string[]): Account {
  return {
    id:         cell(row, ACCOUNT_COLS.ID),
    name:       cell(row, ACCOUNT_COLS.NAME),
    currency:   cell(row, ACCOUNT_COLS.CURRENCY) || 'EUR',
    type:       (cell(row, ACCOUNT_COLS.TYPE) || 'cash') as AccountType,
    balance:    Number(cell(row, ACCOUNT_COLS.BALANCE)) || 0,
    archived:   cell(row, ACCOUNT_COLS.ARCHIVED) === 'TRUE',
    sort_order: Number(cell(row, ACCOUNT_COLS.SORT_ORDER)) || 0,
    created_at: cell(row, ACCOUNT_COLS.CREATED_AT),
    updated_at: cell(row, ACCOUNT_COLS.UPDATED_AT),
  }
}

export function accountToRow(a: Account): string[] {
  const row = new Array(9).fill('')
  row[ACCOUNT_COLS.ID]         = a.id
  row[ACCOUNT_COLS.NAME]       = a.name
  row[ACCOUNT_COLS.CURRENCY]   = a.currency
  row[ACCOUNT_COLS.TYPE]       = a.type
  row[ACCOUNT_COLS.BALANCE]    = String(a.balance)
  row[ACCOUNT_COLS.ARCHIVED]   = a.archived ? 'TRUE' : 'FALSE'
  row[ACCOUNT_COLS.SORT_ORDER] = String(a.sort_order)
  row[ACCOUNT_COLS.CREATED_AT] = a.created_at
  row[ACCOUNT_COLS.UPDATED_AT] = a.updated_at
  return row
}

// ─── Category ────────────────────────────────────────────────────────────────

export function rowToCategory(row: string[]): Category {
  return {
    id:            cell(row, CATEGORY_COLS.ID),
    name:          cell(row, CATEGORY_COLS.NAME),
    icon:          cell(row, CATEGORY_COLS.ICON) || 'Tag',
    color:         cell(row, CATEGORY_COLS.COLOR) || '#6b7280',
    is_expense:    cell(row, CATEGORY_COLS.IS_EXPENSE) !== 'FALSE',
    expense_limit: Number(cell(row, CATEGORY_COLS.EXPENSE_LIMIT)) || 0,
    is_income:     cell(row, CATEGORY_COLS.IS_INCOME) === 'TRUE',
    income_limit:  Number(cell(row, CATEGORY_COLS.INCOME_LIMIT)) || 0,
    sort_order:    Number(cell(row, CATEGORY_COLS.SORT_ORDER)) || 0,
    created_at:    cell(row, CATEGORY_COLS.CREATED_AT),
    updated_at:    cell(row, CATEGORY_COLS.UPDATED_AT),
  }
}

export function categoryToRow(c: Category): string[] {
  const row = new Array(11).fill('')
  row[CATEGORY_COLS.ID]            = c.id
  row[CATEGORY_COLS.NAME]          = c.name
  row[CATEGORY_COLS.ICON]          = c.icon
  row[CATEGORY_COLS.COLOR]         = c.color
  row[CATEGORY_COLS.IS_EXPENSE]    = c.is_expense ? 'TRUE' : 'FALSE'
  row[CATEGORY_COLS.EXPENSE_LIMIT] = String(c.expense_limit)
  row[CATEGORY_COLS.IS_INCOME]     = c.is_income ? 'TRUE' : 'FALSE'
  row[CATEGORY_COLS.INCOME_LIMIT]  = String(c.income_limit)
  row[CATEGORY_COLS.SORT_ORDER]    = String(c.sort_order)
  row[CATEGORY_COLS.CREATED_AT]    = c.created_at
  row[CATEGORY_COLS.UPDATED_AT]    = c.updated_at
  return row
}

// ─── Parse rows (skip header) ─────────────────────────────────────────────────

export function parseTransactionRows(values: string[][]): Transaction[] {
  return values.slice(1).filter(r => r[0]).map(rowToTransaction)
}

export function parseAccountRows(values: string[][]): Account[] {
  return values.slice(1).filter(r => r[0]).map(rowToAccount)
}

export function parseCategoryRows(values: string[][]): Category[] {
  return values.slice(1).filter(r => r[0]).map(rowToCategory)
}
