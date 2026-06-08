import { sheetsRequest, findRowIndex } from './sheetsClient'
import { SHEET_CATEGORIES, CATEGORY_RANGE } from '@/utils/constants'
import { categoryToRow, parseCategoryRows } from '@/utils/sheetsMapper'
import type { Category } from '@/types/category'
import type { SheetsGetResponse } from '@/types/sheets'

const HEADER = [
  'id','name','icon','color','is_expense','expense_limit',
  'is_income','income_limit','sort_order','created_at','updated_at',
]

export async function fetchAllCategories(): Promise<Category[]> {
  const data = await sheetsRequest<SheetsGetResponse>('GET', `values/${CATEGORY_RANGE}`)
  if (!data.values || data.values.length === 0) return []
  return parseCategoryRows(data.values)
}

export async function appendCategory(c: Category): Promise<void> {
  await sheetsRequest('POST', `values/${CATEGORY_RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: [categoryToRow(c)],
  })
}

export async function updateCategory(c: Category): Promise<void> {
  const rowNum = await findRowIndex(SHEET_CATEGORIES, c.id)
  if (!rowNum) { await appendCategory(c); return }
  const range = `${SHEET_CATEGORIES}!A${rowNum}:K${rowNum}`
  await sheetsRequest('PUT', `values/${range}?valueInputOption=RAW`, {
    range, majorDimension: 'ROWS', values: [categoryToRow(c)],
  })
}

export async function ensureCategoryHeader(): Promise<void> {
  const data = await sheetsRequest<SheetsGetResponse>('GET', `values/${SHEET_CATEGORIES}!A1:K1`)
  if (!data.values?.[0]?.length) {
    await sheetsRequest('PUT', `values/${SHEET_CATEGORIES}!A1:K1?valueInputOption=RAW`, {
      range: `${SHEET_CATEGORIES}!A1:K1`, majorDimension: 'ROWS', values: [HEADER],
    })
  }
}
