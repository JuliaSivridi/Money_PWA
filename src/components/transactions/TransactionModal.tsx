import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
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

const CURRENCIES = ['EUR', 'USD', 'RUB']
const getLastAccountId = () => localStorage.getItem('lastAccountId') ?? ''
const saveLastAccountId = (id: string) => { if (id) localStorage.setItem('lastAccountId', id) }

function isoToDisplay(iso: string) {
  if (!iso || iso.length < 10) return ''
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

// ─── AmountInput — must be top-level (not inside another component) ───────────

export function AmountInput({ value, onChange, placeholder = '0.00' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => e.key === 'Enter' && setOpen(v => !v)}
        className={cn(
          'w-full mt-1 px-3 py-2 border rounded-md bg-background text-foreground cursor-pointer select-none',
          open ? 'border-ring ring-2 ring-ring' : 'border-input',
          !value && 'text-muted-foreground',
        )}
      >
        {value || placeholder}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md overflow-hidden border border-border shadow-lg">
          <NumericKeyboard value={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ─── DateInput — top-level ────────────────────────────────────────────────────

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mt-1">
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

// ─── Schema & types ───────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.string().min(1),
  currency: z.string(),
  category_id: z.string(),
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeAccounts = accounts.filter(a => !a.archived)

  const { handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '', currency: baseCurrency, category_id: '', account_id: '',
      to_account_id: '', to_amount: '', to_currency: baseCurrency,
      date: todayISO(), comment: '', debt_subtype: 'lent', debt_ref_id: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      const tabType: TabType =
        editing.type === 'expense' ? 'expense'
        : editing.type === 'income' ? 'income'
        : editing.type === 'transfer' ? 'transfer'
        : 'debt'
      setTab(tabType)
      reset({
        amount: String(editing.amount), currency: editing.currency,
        category_id: editing.category_id, account_id: editing.account_id,
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
        amount: '', currency: baseCurrency, category_id: '',
        account_id: getLastAccountId(),
        to_account_id: '', to_amount: '', to_currency: baseCurrency,
        date: todayISO(), comment: '', debt_subtype: 'lent', debt_ref_id: '',
      })
    }
  }, [open, editing, baseCurrency, reset])

  const categoryUsage = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of transactions) {
      if (t.category_id) counts[t.category_id] = (counts[t.category_id] ?? 0) + 1
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
        category_id: tab === 'transfer' || tab === 'debt' ? '' : values.category_id,
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

  const inputCls = 'w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

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
            <TabsContent value="expense" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Amount</Label>
                  <Controller name="amount" control={control} render={({ field }) => (
                    <AmountInput value={field.value} onChange={field.onChange} />
                  )} />
                  {errors.amount && <p className="text-destructive text-xs mt-1">Required</p>}
                </div>
                <div className="w-28">
                  <Label>Currency</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <div className="mt-2 max-h-44 overflow-y-auto rounded-md">
                  <div className="grid grid-cols-4 gap-2">
                    {sortedExpense.map(cat => (
                      <Controller key={cat.id} name="category_id" control={control} render={({ field }) => (
                        <button type="button" onClick={() => field.onChange(cat.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${field.value === cat.id ? 'border-primary bg-accent' : 'border-border hover:bg-accent'}`}>
                          <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                          <span className="text-xs truncate w-full text-center">{cat.name}</span>
                        </button>
                      )} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Account</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                {errors.account_id && <p className="text-destructive text-xs mt-1">Required</p>}
              </div>
              <div>
                <Label>Date</Label>
                <Controller name="date" control={control} render={({ field }) => (
                  <DateInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Comment</Label>
                <Controller name="comment" control={control} render={({ field }) => (
                  <input {...field} className={inputCls} placeholder="Optional" />
                )} />
              </div>
            </TabsContent>

            {/* ── INCOME ── */}
            <TabsContent value="income" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Amount</Label>
                  <Controller name="amount" control={control} render={({ field }) => (
                    <AmountInput value={field.value} onChange={field.onChange} />
                  )} />
                  {errors.amount && <p className="text-destructive text-xs mt-1">Required</p>}
                </div>
                <div className="w-28">
                  <Label>Currency</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <div className="mt-2 max-h-44 overflow-y-auto rounded-md">
                  <div className="grid grid-cols-4 gap-2">
                    {sortedIncome.map(cat => (
                      <Controller key={cat.id} name="category_id" control={control} render={({ field }) => (
                        <button type="button" onClick={() => field.onChange(cat.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${field.value === cat.id ? 'border-primary bg-accent' : 'border-border hover:bg-accent'}`}>
                          <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                          <span className="text-xs truncate w-full text-center">{cat.name}</span>
                        </button>
                      )} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Account</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>Date</Label>
                <Controller name="date" control={control} render={({ field }) => (
                  <DateInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Comment</Label>
                <Controller name="comment" control={control} render={({ field }) => (
                  <input {...field} className={inputCls} placeholder="Optional" />
                )} />
              </div>
            </TabsContent>

            {/* ── TRANSFER ── */}
            <TabsContent value="transfer" className="space-y-4 mt-4">
              <div>
                <Label>From account</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Amount</Label>
                  <Controller name="amount" control={control} render={({ field }) => (
                    <AmountInput value={field.value} onChange={field.onChange} />
                  )} />
                </div>
                <div className="w-28">
                  <Label>Currency</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={v => { field.onChange(v); setValue('to_currency', v); setValue('to_amount', watchAmount) }}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div>
                <Label>To account</Label>
                <Controller name="to_account_id" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>To amount</Label>
                  <Controller name="to_amount" control={control} render={({ field }) => (
                    <AmountInput value={field.value} onChange={field.onChange} placeholder={watchAmount} />
                  )} />
                </div>
                <div className="w-28">
                  <Label>To currency</Label>
                  <Controller name="to_currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Controller name="date" control={control} render={({ field }) => (
                  <DateInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Comment</Label>
                <Controller name="comment" control={control} render={({ field }) => (
                  <input {...field} className={inputCls} placeholder="Optional" />
                )} />
              </div>
            </TabsContent>

            {/* ── DEBT ── */}
            <TabsContent value="debt" className="space-y-4 mt-4">
              <div>
                <Label>Debt type</Label>
                <Controller name="debt_subtype" control={control} render={({ field }) => (
                  <div className="flex gap-2 mt-1">
                    {(['lent', 'borrowed'] as const).map(v => (
                      <button key={v} type="button" onClick={() => field.onChange(v)}
                        className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${field.value === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                        {v === 'lent' ? 'I lent' : 'I borrowed'}
                      </button>
                    ))}
                  </div>
                )} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Amount</Label>
                  <Controller name="amount" control={control} render={({ field }) => (
                    <AmountInput value={field.value} onChange={field.onChange} />
                  )} />
                </div>
                <div className="w-28">
                  <Label>Currency</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div>
                <Label>Account</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>Date</Label>
                <Controller name="date" control={control} render={({ field }) => (
                  <DateInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Comment</Label>
                <Controller name="comment" control={control} render={({ field }) => (
                  <input {...field} className={inputCls} placeholder="Name of person" />
                )} />
              </div>
              {editing && !editing.debt_ref_id && (
                <Button type="button" variant="outline" className="w-full" onClick={async () => {
                  await addTransaction({
                    date: todayISO(), type: editing.type, amount: editing.amount,
                    currency: editing.currency, amount_base: 0, account_id: editing.account_id,
                    category_id: '', to_account_id: '', to_amount: 0, to_currency: '',
                    debt_ref_id: editing.id, comment: editing.comment,
                  })
                  onClose()
                }}>Mark as repaid</Button>
              )}
            </TabsContent>
          </Tabs>

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
