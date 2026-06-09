export const SHEET_TRANSACTIONS = 'transactions'
export const SHEET_ACCOUNTS = 'accounts'
export const SHEET_CATEGORIES = 'categories'
export const SHEET_SETTINGS = 'settings'

export const TRANSACTION_COLS = {
  ID: 0,
  DATE: 1,
  TYPE: 2,
  AMOUNT: 3,
  CURRENCY: 4,
  AMOUNT_BASE: 5,
  ACCOUNT_ID: 6,
  CATEGORY_IDS: 7,
  TO_ACCOUNT_ID: 8,
  TO_AMOUNT: 9,
  TO_CURRENCY: 10,
  DEBT_REF_ID: 11,
  COMMENT: 12,
  CREATED_AT: 13,
  UPDATED_AT: 14,
} as const

export const ACCOUNT_COLS = {
  ID: 0,
  NAME: 1,
  CURRENCY: 2,
  TYPE: 3,
  BALANCE: 4,
  ARCHIVED: 5,
  SORT_ORDER: 6,
  CREATED_AT: 7,
  UPDATED_AT: 8,
  COLOR: 9,
} as const

export const CATEGORY_COLS = {
  ID: 0,
  NAME: 1,
  ICON: 2,
  COLOR: 3,
  IS_EXPENSE: 4,
  EXPENSE_LIMIT: 5,
  IS_INCOME: 6,
  INCOME_LIMIT: 7,
  SORT_ORDER: 8,
  CREATED_AT: 9,
  UPDATED_AT: 10,
} as const

export const TRANSACTION_RANGE = `${SHEET_TRANSACTIONS}!A:O`
export const ACCOUNT_RANGE = `${SHEET_ACCOUNTS}!A:J`
export const CATEGORY_RANGE = `${SHEET_CATEGORIES}!A:K`

export const SPREADSHEET_TITLE = 'db_money'
