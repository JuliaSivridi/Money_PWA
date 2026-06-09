import { sheetsRequest, findRowIndex } from './sheetsClient'
import { SHEET_ACCOUNTS, ACCOUNT_RANGE } from '@/utils/constants'
import { accountToRow, parseAccountRows } from '@/utils/sheetsMapper'
import type { Account } from '@/types/account'
import type { SheetsGetResponse } from '@/types/sheets'

const HEADER = ['id','name','currency','type','balance','archived','sort_order','created_at','updated_at']

export async function fetchAllAccounts(): Promise<Account[]> {
  const data = await sheetsRequest<SheetsGetResponse>('GET', `values/${ACCOUNT_RANGE}`)
  if (!data.values || data.values.length === 0) return []
  return parseAccountRows(data.values)
}

export async function appendAccount(a: Account): Promise<void> {
  await sheetsRequest('POST', `values/${ACCOUNT_RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [accountToRow(a)],
  })
}

export async function updateAccount(a: Account): Promise<void> {
  const rowNum = await findRowIndex(SHEET_ACCOUNTS, a.id)
  if (!rowNum) { await appendAccount(a); return }
  const range = `${SHEET_ACCOUNTS}!A${rowNum}:J${rowNum}`
  await sheetsRequest('PUT', `values/${range}?valueInputOption=RAW`, {
    range, majorDimension: 'ROWS', values: [accountToRow(a)],
  })
}

export async function ensureAccountHeader(): Promise<void> {
  const data = await sheetsRequest<SheetsGetResponse>('GET', `values/${SHEET_ACCOUNTS}!A1:I1`)
  if (!data.values?.[0]?.length) {
    await sheetsRequest('PUT', `values/${SHEET_ACCOUNTS}!A1:I1?valueInputOption=RAW`, {
      range: `${SHEET_ACCOUNTS}!A1:I1`, majorDimension: 'ROWS', values: [HEADER],
    })
  }
}
