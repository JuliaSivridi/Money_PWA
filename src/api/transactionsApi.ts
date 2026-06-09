import { sheetsRequest, findRowIndex } from './sheetsClient'
import { SHEET_TRANSACTIONS, TRANSACTION_RANGE } from '@/utils/constants'
import { transactionToRow, parseTransactionRows } from '@/utils/sheetsMapper'
import type { Transaction } from '@/types/transaction'
import type { SheetsGetResponse } from '@/types/sheets'

const HEADER = [
  'id','date','time','type','amount','currency','amount_base',
  'account_id','category_ids','to_account_id','to_amount','to_currency',
  'debt_ref_id','comment','created_at','updated_at',
]

export async function fetchAllTransactions(): Promise<Transaction[]> {
  const data = await sheetsRequest<SheetsGetResponse>('GET', `values/${TRANSACTION_RANGE}`)
  if (!data.values || data.values.length === 0) return []
  return parseTransactionRows(data.values)
}

export async function appendTransaction(t: Transaction): Promise<void> {
  await sheetsRequest('POST', `values/${TRANSACTION_RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [transactionToRow(t)],
  })
}

export async function updateTransaction(t: Transaction): Promise<void> {
  const rowNum = await findRowIndex(SHEET_TRANSACTIONS, t.id)
  if (!rowNum) { await appendTransaction(t); return }
  const range = `${SHEET_TRANSACTIONS}!A${rowNum}:P${rowNum}`
  await sheetsRequest('PUT', `values/${range}?valueInputOption=RAW`, {
    range, majorDimension: 'ROWS', values: [transactionToRow(t)],
  })
}

export async function ensureTransactionHeader(): Promise<void> {
  const data = await sheetsRequest<SheetsGetResponse>('GET', `values/${SHEET_TRANSACTIONS}!A1:P1`)
  if (!data.values?.[0]?.length) {
    await sheetsRequest('PUT', `values/${SHEET_TRANSACTIONS}!A1:P1?valueInputOption=RAW`, {
      range: `${SHEET_TRANSACTIONS}!A1:P1`, majorDimension: 'ROWS', values: [HEADER],
    })
  }
}
