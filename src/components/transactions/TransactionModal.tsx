import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { NumericKeyboard } from '@/components/common/NumericKeyboard'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useAccountsStore } from '@/store/accountsStore'
import { useCategoriesStore } from '@/store/categoriesStore'
import { usePrefsStore } from '@/store/prefsStore'
import { todayISO } from '@/utils/dateUtils'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionType } from '@/types/transaction'

const getLastAccountId = () => localStorage.getItem('money-lastAccountId') ?? ''
const saveLastAccountId = (id: string) => { if (id) localStorage.setItem('money-lastAccountId', id) }

function isoToDisplay(iso: string) {
  if (!iso || iso.length < 10) return ''
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

// ─── AmountField — tappable display, highlights when active ──────────────────

export function AmountInput({ value, placeholder = '0.00' }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; autoOpen?: boolean
}) {
  return (
    <div className={cn(
      'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground select-none',
      !value && 'text-muted-foreground',
    )}>
      {value || placeholder}
    </div>
  )
}

function AmountField({ value, active, onActivate, placeholder }: {
  value: string; active: boolean; onActivate: () => void; placeholder: string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      className={cn(
        'w-28 shrink-0 px-3 py-2 border rounded-md bg-background text-foreground cursor-pointer select-none text-right',
        active ? 'border-ring ring-2 ring-ring' : 'border-input',
        !value && 'text-muted-foreground',
      )}
    >
      {value || placeholder}
    </div>
  )
}

// ─── DateInput ────────────────────────────────────────────────────────────────

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <div className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm text-foreground pointer-events-none min-h-[38px]">
        {value ? isoToDisplay(value) : <span className="text-muted-foreground">DD.MM.YYYY</span>}
      </div>
      <input
        type="date"
        value={value}
        onChange={e => { if (e.target.value) onChange(e.target.value) }}
        required
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      />
    </div>
  )
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.string().min(1),
  currency: z.string(),
  category_ids: z.array(z.string()),
  account_id: z.string().min(1, 'Select account'),
  to_account_id: z.string(),
  to_amount: z.string(),
  to_currency: z.string(),
  date: z.string().min(1),
  comment: z.string(),
  debt_subtype: z.enum(['lent', 'borrowed']),
  debt_ref_id: z.string(),
})
type FormValues = z.infer<typeof schema>
type TabType = 'expense' | 'income' | 'transfer' | 'debt'
type ActiveField = 'amount' | 'to_amount'

interface Props {
  open: boolean
  editing?: Transaction | null
  onClose: () => void
}

// ─── TransactionModal ─────────────────────────────────────────────────────────

export function TransactionModal({ open, editing, onClose }: Props) {
  const { addTransaction, updateTransaction, deleteTransaction, transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = usePrefsStore()

  const [tab, setTab] = useState<TabType>('expense')
  const [activeField, setActiveField] = useState<ActiveField>('amount')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeAccounts = accounts.filter(a => !a.archived)

  const { handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '', currency: baseCurrency, category_ids: [],
      account_id: '', to_account_id: '', to_amount: '', to_currency: baseCurrency,
      date: todayISO(), comment: '', debt_subtype: 'lent', debt_ref_id: '',
    },
  })

  // Reset active field when tab changes
  useEffect(() => { setActiveField('amount') }, [tab])

  // Auto-fill currency from selected account
  const watchAccountId = watch('account_id')
  const watchToAccountId = watch('to_account_id')
  useEffect(() => {
    const acc = activeAccounts.find(a => a.id === watchAccountId)
    if (acc) setValue('currency', acc.currency)
  }, [watchAccountId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const acc = activeAccounts.find(a => a.id === watchToAccountId)
    if (acc) setValue('to_currency', acc.currency)
  }, [watchToAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const defaultAccountId = getLastAccountId() || activeAccounts[0]?.id || ''
    if (editing) {
      const tabType: TabType =
        editing.type === 'expense' ? 'expense'
        : editing.type === 'income' ? 'income'
        : editing.type === 'transfer' ? 'transfer'
        : 'debt'
      setTab(tabType)
      reset({
        amount: String(editing.amount), currency: editing.currency,
        category_ids: editing.category_ids, account_id: editing.account_id,
        to_account_id: editing.to_account_id,
        to_amount: editing.to_amount ? String(editing.to_amount) : '',
        to_currency: editing.to_currency || baseCurrency,
        date: editing.date, comment: editing.comment,
        debt_subtype: editing.type === 'debt_borrowed' ? 'borrowed' : 'lent',
        debt_ref_id: editing.debt_ref_id,
      })
    } else {
      setTab('expense')
      reset({
        amount: '', currency: baseCurrency, category_ids: [],
        account_id: defaultAccountId,
        to_account_id: '', to_amount: '', to_currency: baseCurrency,
        date: todayISO(), comment: '', debt_subtype: 'lent', debt_ref_id: '',
      })
    }
  }, [open, editing, baseCurrency, reset]) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryUsage = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of transactions) {
      for (const id of t.category_ids) {
        counts[id] = (counts[id] ?? 0) + 1
      }
    }
    return counts
  }, [transactions])

  const sortedExpense = useMemo(() =>
    [...categories.filter(c => c.is_expense)].sort((a, b) => (categoryUsage[b.id] ?? 0) - (categoryUsage[a.id] ?? 0)),
    [categories, categoryUsage])

  const sortedIncome = useMemo(() =>
    [...categories.filter(c => c.is_income)].sort((a, b) => (categoryUsage[b.id] ?? 0) - (categoryUsage[a.id] ?? 0)),
    [categories, categoryUsage])

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      let type: TransactionType
      if (tab === 'expense') type = 'expense'
      else if (tab === 'income') type = 'income'
      else if (tab === 'transfer') type = 'transfer'
      else type = values.debt_subtype === 'lent' ? 'debt_lent' : 'debt_borrowed'

      saveLastAccountId(values.account_id)
      const input = {
        date: values.date, type,
        amount: parseFloat(values.amount) || 0,
        currency: values.currency, amount_base: 0,
        account_id: values.account_id,
        category_ids: tab === 'transfer' || tab === 'debt' ? [] : values.category_ids,
        to_account_id: tab === 'transfer' ? values.to_account_id : '',
        to_amount: tab === 'transfer' ? (parseFloat(values.to_amount) || parseFloat(values.amount) || 0) : 0,
        to_currency: tab === 'transfer' ? values.to_currency : '',
        debt_ref_id: values.debt_ref_id, comment: values.comment,
      }
      editing ? await updateTransaction(editing.id, input) : await addTransaction(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    setSaving(true)
    try { await deleteTransaction(editing.id) } finally { setSaving(false) }
    setConfirmDelete(false)
    onClose()
  }

  const watchAmount = watch('amount')
  const watchToAmount = watch('to_amount')
  const watchCurrency = watch('currency')
  const watchToCurrency = watch('to_currency')

  const crossCurrency = tab === 'transfer' && watchToCurrency !== watchCurrency

  // Shared keyboard value / handler
  const kbValue = activeField === 'to_amount' ? watchToAmount : watchAmount
  const kbOnChange = (v: string) => setValue(activeField, v)

  const inputCls = 'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  const categoryGrid = (cats: typeof sortedExpense) => (
    <Controller name="category_ids" control={control} render={({ field }) => {
      const toggle = (id: string) => {
        const cur = field.value as string[]
        const idx = cur.indexOf(id)
        if (idx === -1) {
          // max 2 categories; if already 2, replace the second
          field.onChange(cur.length < 2 ? [...cur, id] : [cur[0], id])
        } else {
          field.onChange(cur.filter(c => c !== id))
        }
      }
      return (
        <div className="max-h-36 overflow-y-auto rounded-md">
          <div className="grid grid-cols-4 gap-2">
            {cats.map(cat => {
              const pos = (field.value as string[]).indexOf(cat.id)
              const selected = pos !== -1
              const isPrimary = pos === 0
              return (
                <button key={cat.id} type="button" onClick={() => toggle(cat.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1 p-2 rounded-md border transition-colors',
                    selected ? 'border-primary bg-accent' : 'border-border hover:bg-accent'
                  )}>
                  <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                  <span className="text-xs truncate w-full text-center">{cat.name}</span>
                  {selected && (
                    <span className={cn(
                      'absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center',
                      isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/60 text-background'
                    )}>
                      {pos + 1}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )
    }} />
  )

  const accountSelect = (name: 'account_id' | 'to_account_id', placeholder: string) => (
    <Controller name={name} control={control} render={({ field }) => (
      <Select value={field.value} onValueChange={field.onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {field.value && (() => {
              const acc = activeAccounts.find(a => a.id === field.value)
              return acc ? (
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color || '#6b7280' }} />
                  {acc.name}
                </span>
              ) : null
            })()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {activeAccounts.map(a => (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color || '#6b7280' }} />
                {a.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )} />
  )

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit transaction' : 'New transaction'}</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">Expense</TabsTrigger>
              <TabsTrigger value="income" className="flex-1">Income</TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1">Transfer</TabsTrigger>
              <TabsTrigger value="debt" className="flex-1">Debt</TabsTrigger>
            </TabsList>

            {/* ── EXPENSE ── */}
            <TabsContent value="expense" className="space-y-3 mt-3">
              <Controller name="date" control={control} render={({ field }) => (
                <DateInput value={field.value} onChange={field.onChange} />
              )} />
              {categoryGrid(sortedExpense)}
              <div className="flex gap-2 items-center">
                <div className="flex-1">{accountSelect('account_id', 'Account')}</div>
                <AmountField value={watchAmount} active={activeField === 'amount'} onActivate={() => setActiveField('amount')} placeholder={`0.00`} />
              </div>
              {(errors.amount || errors.account_id) && <p className="text-destructive text-xs -mt-2">Fill in account and amount</p>}
              <Controller name="comment" control={control} render={({ field }) => (
                <input {...field} className={inputCls} placeholder="Comment" />
              )} />
            </TabsContent>

            {/* ── INCOME ── */}
            <TabsContent value="income" className="space-y-3 mt-3">
              <Controller name="date" control={control} render={({ field }) => (
                <DateInput value={field.value} onChange={field.onChange} />
              )} />
              {categoryGrid(sortedIncome)}
              <div className="flex gap-2 items-center">
                <div className="flex-1">{accountSelect('account_id', 'Account')}</div>
                <AmountField value={watchAmount} active={activeField === 'amount'} onActivate={() => setActiveField('amount')} placeholder={`0.00`} />
              </div>
              <Controller name="comment" control={control} render={({ field }) => (
                <input {...field} className={inputCls} placeholder="Comment" />
              )} />
            </TabsContent>

            {/* ── TRANSFER ── */}
            <TabsContent value="transfer" className="space-y-3 mt-3">
              <Controller name="date" control={control} render={({ field }) => (
                <DateInput value={field.value} onChange={field.onChange} />
              )} />
              <div className="flex gap-2 items-center">
                <div className="flex-1">{accountSelect('account_id', 'From account')}</div>
                <AmountField value={watchAmount} active={activeField === 'amount'} onActivate={() => setActiveField('amount')} placeholder="0.00" />
              </div>
              {crossCurrency ? (
                <div className="flex gap-2 items-center">
                  <div className="flex-1">{accountSelect('to_account_id', 'To account')}</div>
                  <AmountField value={watchToAmount} active={activeField === 'to_amount'} onActivate={() => setActiveField('to_amount')} placeholder={watchToCurrency} />
                </div>
              ) : (
                accountSelect('to_account_id', 'To account')
              )}
              <Controller name="comment" control={control} render={({ field }) => (
                <input {...field} className={inputCls} placeholder="Comment" />
              )} />
            </TabsContent>

            {/* ── DEBT ── */}
            <TabsContent value="debt" className="space-y-3 mt-3">
              <Controller name="date" control={control} render={({ field }) => (
                <DateInput value={field.value} onChange={field.onChange} />
              )} />
              <Controller name="debt_subtype" control={control} render={({ field }) => (
                <div className="flex gap-2">
                  {(['lent', 'borrowed'] as const).map(v => (
                    <button key={v} type="button" onClick={() => field.onChange(v)}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${field.value === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                      {v === 'lent' ? 'I lent' : 'I borrowed'}
                    </button>
                  ))}
                </div>
              )} />
              <div className="flex gap-2 items-center">
                <div className="flex-1">{accountSelect('account_id', 'Account')}</div>
                <AmountField value={watchAmount} active={activeField === 'amount'} onActivate={() => setActiveField('amount')} placeholder="0.00" />
              </div>
              <Controller name="comment" control={control} render={({ field }) => (
                <input {...field} className={inputCls} placeholder="Person's name" />
              )} />
              {editing && !editing.debt_ref_id && (
                <Button type="button" variant="outline" className="w-full" onClick={async () => {
                  await addTransaction({
                    date: todayISO(), type: editing.type, amount: editing.amount,
                    currency: editing.currency, amount_base: 0, account_id: editing.account_id,
                    category_ids: [], to_account_id: '', to_amount: 0, to_currency: '',
                    debt_ref_id: editing.id, comment: editing.comment,
                  })
                  onClose()
                }}>Mark as repaid</Button>
              )}
            </TabsContent>
          </Tabs>

          {/* ── Shared keyboard ── */}
          <div className="rounded-md overflow-hidden border border-border">
            <NumericKeyboard value={kbValue} onChange={kbOnChange} />
          </div>

          <DialogFooter className="flex-row items-center">
            {editing && (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving} className="mr-auto">
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void handleSubmit(onSubmit)()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete transaction?"
        description="This will reverse the balance change."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
