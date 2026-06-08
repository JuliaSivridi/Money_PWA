import { sheetsRequest } from './sheetsClient'
import { now, todayISO } from '@/utils/dateUtils'
import { generateId } from '@/utils/uuid'

export async function seedOnboarding(): Promise<void> {
  const ts = now()
  const today = todayISO()

  const acc1Id = generateId('acc')
  const acc2Id = generateId('acc')
  const cat1Id = generateId('cat')
  const cat2Id = generateId('cat')
  const cat3Id = generateId('cat')

  const txnHeader = [
    'id','date','type','amount','currency','amount_base',
    'account_id','category_id','to_account_id','to_amount','to_currency',
    'debt_ref_id','comment','created_at','updated_at',
  ]
  const accHeader = ['id','name','currency','type','balance','archived','sort_order','created_at','updated_at']
  const catHeader = [
    'id','name','icon','color','is_expense','expense_limit',
    'is_income','income_limit','sort_order','created_at','updated_at',
  ]

  const accRows = [
    [acc1Id, 'Cash (€)', 'EUR', 'cash', '0', 'FALSE', '1', ts, ts],
    [acc2Id, 'Cash (₽)', 'RUB', 'cash', '0', 'FALSE', '2', ts, ts],
  ]

  const catRows = [
    [cat1Id, 'Groceries', 'ShoppingCart', '#22c55e', 'TRUE', '0', 'FALSE', '0', '1', ts, ts],
    [cat2Id, 'Transport', 'Bus',          '#3b82f6', 'TRUE', '0', 'FALSE', '0', '2', ts, ts],
    [cat3Id, 'Health',    'Heart',         '#f87171', 'TRUE', '0', 'FALSE', '0', '3', ts, ts],
  ]

  // seed one expense so the transactions sheet has data right away
  const txn1Id = generateId('txn')
  const txnRows = [
    [txn1Id, today, 'expense', '10', 'EUR', '10', acc1Id, cat1Id, '', '0', '', '', 'Groceries', ts, ts],
  ]

  await sheetsRequest('POST', 'values:batchUpdate', {
    valueInputOption: 'RAW',
    data: [
      { range: 'transactions!A1:O1', values: [txnHeader] },
      { range: 'transactions!A2:O2', values: txnRows },
      { range: 'accounts!A1:I1',     values: [accHeader] },
      { range: 'accounts!A2:I3',     values: accRows },
      { range: 'categories!A1:K1',   values: [catHeader] },
      { range: 'categories!A2:K4',   values: catRows },
    ],
  })
}
