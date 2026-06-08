import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAccountsStore } from '@/store/accountsStore'
import type { Account } from '@/types/account'

const schema = z.object({
  name: z.string().min(1),
  currency: z.string(),
  type: z.enum(['card', 'cash', 'savings', 'investment']),
  opening_balance: z.string(),
  archived: z.boolean(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  editing?: Account | null
  onClose: () => void
}

export function AccountModal({ open, editing, onClose }: Props) {
  const { addAccount, updateAccount, archiveAccount } = useAccountsStore()

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', currency: 'EUR', type: 'cash', opening_balance: '0', archived: false },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({ name: editing.name, currency: editing.currency, type: editing.type, opening_balance: String(editing.balance), archived: editing.archived })
    } else {
      reset({ name: '', currency: 'EUR', type: 'cash', opening_balance: '0', archived: false })
    }
  }, [open, editing, reset])

  const onSubmit = async (values: FormValues) => {
    if (editing) {
      await updateAccount(editing.id, { name: values.name, currency: values.currency, type: values.type })
      if (values.archived && !editing.archived) await archiveAccount(editing.id)
    } else {
      await addAccount({
        name: values.name,
        currency: values.currency,
        type: values.type,
        balance: parseFloat(values.opening_balance) || 0,
        archived: false,
        sort_order: 0,
      })
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit account' : 'New account'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <input {...register('name')} className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="Account name" />
            {errors.name && <p className="text-destructive text-xs mt-1">Required</p>}
          </div>

          <div>
            <Label>Currency</Label>
            <Controller name="currency" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['EUR', 'USD', 'RUB'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div>
            <Label>Type</Label>
            <Controller name="type" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          {!editing && (
            <div>
              <Label>Opening balance</Label>
              <input {...register('opening_balance')} type="number" step="0.01" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="0.00" />
            </div>
          )}

          {editing && (
            <div className="flex items-center gap-2">
              <Controller name="archived" control={control} render={({ field }) => (
                <input type="checkbox" id="archived" checked={field.value} onChange={field.onChange} className="w-4 h-4" />
              )} />
              <Label htmlFor="archived">Archive account</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSubmit(onSubmit)()} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
