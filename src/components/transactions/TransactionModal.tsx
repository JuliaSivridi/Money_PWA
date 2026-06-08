import { useState, useEffect } from 'react'
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
import { useTransactionsStore } from '@/store/transactionsStore'
import { useAccountsStore } from '@/store/accountsStore'
import { useCategoriesStore } from '@/store/categoriesStore'
import { usePrefsStore } from '@/store/prefsStore'
import { todayISO } from '@/utils/dateUtils'
import type { Transaction, TransactionType } from '@/types/transaction'

const CURRENCIES = ['EUR', 'USD', 'RUB']

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

export function TransactionModal({ open, editing, onClose }: Props) {
  const { addTransaction, updateTransaction, deleteTransaction } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = usePrefsStore()

  const [tab, setTab] = useState<TabType>('expense')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeAccounts = accounts.filter(a => !a.archived)

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      currency: baseCurrency,
      category_id: '',
      account_id: '',
      to_account_id: '',
      to_amount: '',
      to_currency: baseCurrency,
      date: todayISO(),
      comment: '',
      debt_subtype: 'lent',
      debt_ref_id: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      const type = editing.type
      const tabType: TabType =
        type === 'expense' ? 'expense'
        : type === 'income' ? 'income'
        : type === 'transfer' ? 'transfer'
        : 'debt'
      setTab(tabType)
      reset({
        amount: String(editing.amount),
        currency: editing.currency,
        category_id: editing.category_id,
        account_id: editing.account_id,
        to_account_id: editing.to_account_id,
        to_amount: editing.to_amount ? String(editing.to_amount) : '',
        to_currency: editing.to_currency || baseCurrency,
        date: editing.date,
        comment: editing.comment,
        debt_subtype: editing.type === 'debt_borrowed' ? 'borrowed' : 'lent',
        debt_ref_id: editing.debt_ref_id,
      })
    } else {
      reset({
        amount: '', currency: baseCurrency, category_id: '', account_id: '',
        to_account_id: '', to_amount: '', to_currency: baseCurrency,
        date: todayISO(), comment: '', debt_subtype: 'lent', debt_ref_id: '',
      })
    }
  }, [open, editing, baseCurrency, reset])

  const expenseCategories = categories.filter(c => c.is_expense)
  const incomeCategories = categories.filter(c => c.is_income)

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      let type: TransactionType
      if (tab === 'expense') type = 'expense'
      else if (tab === 'income') type = 'income'
      else if (tab === 'transfer') type = 'transfer'
      else type = values.debt_subtype === 'lent' ? 'debt_lent' : 'debt_borrowed'

      const input = {
        date: values.date,
        type,
        amount: parseFloat(values.amount) || 0,
        currency: values.currency,
        amount_base: 0,
        account_id: values.account_id,
        category_id: tab === 'transfer' || tab === 'debt' ? '' : values.category_id,
        to_account_id: tab === 'transfer' ? values.to_account_id : '',
        to_amount: tab === 'transfer' ? (parseFloat(values.to_amount) || parseFloat(values.amount) || 0) : 0,
        to_currency: tab === 'transfer' ? values.to_currency : '',
        debt_ref_id: values.debt_ref_id,
        comment: values.comment,
      }

      if (editing) {
        await updateTransaction(editing.id, input)
      } else {
        await addTransaction(input)
      }
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

            {/* Expense / Income */}
            {(['expense', 'income'] as const).map(txType => (
              <TabsContent key={txType} value={txType} className="space-y-4 mt-4">
                {/* Amount + currency */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label>Amount</Label>
                    <input
                      {...register('amount')}
                      type="number" step="0.01" min="0"
                      className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="0.00"
                    />
                    {errors.amount && <p className="text-destructive text-xs mt-1">Required</p>}
                  </div>
                  <div className="w-28">
                    <Label>Currency</Label>
                    <Controller name="currency" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <Label>Category</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {(txType === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                      <Controller key={cat.id} name="category_id" control={control} render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(cat.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${field.value === cat.id ? 'border-primary bg-accent' : 'border-border hover:bg-accent'}`}
                        >
                          <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                          <span className="text-xs truncate w-full text-center">{cat.name}</span>
                        </button>
                      )} />
                    ))}
                  </div>
                </div>

                {/* Account */}
                <div>
                  <Label>Account</Label>
                  <Controller name="account_id" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.account_id && <p className="text-destructive text-xs mt-1">Required</p>}
                </div>

                {/* Date */}
                <div>
                  <Label>Date</Label>
                  <input {...register('date')} type="date" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Comment */}
                <div>
                  <Label>Comment</Label>
                  <input {...register('comment')} className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Optional" />
                </div>
              </TabsContent>
            ))}

            {/* Transfer */}
            <TabsContent value="transfer" className="space-y-4 mt-4">
              <div>
                <Label>From account</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Amount</Label>
                  <input {...register('amount')} type="number" step="0.01" min="0" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="0.00" />
                </div>
                <div className="w-28">
                  <Label>Currency</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); setValue('to_currency', v); setValue('to_amount', watchAmount) }}>
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
                    <SelectContent>
                      {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>To amount</Label>
                  <input {...register('to_amount')} type="number" step="0.01" min="0" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder={watchAmount} />
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
                <input {...register('date')} type="date" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" />
              </div>
              <div>
                <Label>Comment</Label>
                <input {...register('comment')} className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="Optional" />
              </div>
            </TabsContent>

            {/* Debt */}
            <TabsContent value="debt" className="space-y-4 mt-4">
              <div>
                <Label>Debt type</Label>
                <Controller name="debt_subtype" control={control} render={({ field }) => (
                  <div className="flex gap-2 mt-1">
                    {(['lent', 'borrowed'] as const).map(v => (
                      <button key={v} type="button" onClick={() => field.onChange(v)}
                        className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${field.value === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
                      >
                        {v === 'lent' ? 'I lent' : 'I borrowed'}
                      </button>
                    ))}
                  </div>
                )} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Amount</Label>
                  <input {...register('amount')} type="number" step="0.01" min="0" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="0.00" />
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
                <input {...register('date')} type="date" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" />
              </div>
              <div>
                <Label>Counterpart name</Label>
                <input {...register('comment')} className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="Name of person" />
              </div>

              {editing && !editing.debt_ref_id && (
                <Button type="button" variant="outline" className="w-full" onClick={async () => {
                  // Mark as repaid — create closing transaction
                  const input = {
                    date: todayISO(),
                    type: editing.type,
                    amount: editing.amount,
                    currency: editing.currency,
                    amount_base: 0,
                    account_id: editing.account_id,
                    category_id: '',
                    to_account_id: '',
                    to_amount: 0,
                    to_currency: '',
                    debt_ref_id: editing.id,
                    comment: editing.comment,
                  }
                  await addTransaction(input)
                  onClose()
                }}>
                  Mark as repaid
                </Button>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editing && (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void handleSubmit(onSubmit)()} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
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
