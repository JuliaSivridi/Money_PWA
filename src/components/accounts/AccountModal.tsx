import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColorPicker } from '@/components/common/ColorPicker'
import { useAccountsStore } from '@/store/accountsStore'
import type { Account } from '@/types/account'

const schema = z.object({
  name: z.string().min(1),
  currency: z.string(),
  type: z.enum(['card', 'cash', 'savings', 'investment']),
  color: z.string(),
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
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', currency: 'EUR', type: 'cash', color: '#6b7280', opening_balance: '0', archived: false },
  })

  useEffect(() => {
    if (!open) return
    setColorPickerOpen(false)
    if (editing) {
      reset({ name: editing.name, currency: editing.currency, type: editing.type, color: editing.color || '#6b7280', opening_balance: String(editing.balance), archived: editing.archived })
    } else {
      reset({ name: '', currency: 'EUR', type: 'cash', color: '#6b7280', opening_balance: '0', archived: false })
    }
  }, [open, editing, reset])

  const watchColor = watch('color')

  const onSubmit = async (values: FormValues) => {
    if (editing) {
      await updateAccount(editing.id, { name: values.name, currency: values.currency, type: values.type, color: values.color })
      if (values.archived && !editing.archived) await archiveAccount(editing.id)
    } else {
      await addAccount({
        name: values.name,
        currency: values.currency,
        type: values.type,
        color: values.color,
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
          <div className="flex items-center gap-3">
            {/* Color swatch — tap to open picker */}
            <button type="button" onClick={() => setColorPickerOpen(p => !p)}
              className="w-9 h-9 rounded-full border-2 border-border flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ backgroundColor: watchColor }}
            />
            <input
              {...register('name')}
              autoFocus
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              placeholder="Account name"
            />
          </div>
          {errors.name && <p className="text-destructive text-xs -mt-2">Required</p>}

          {colorPickerOpen && (
            <Controller name="color" control={control} render={({ field }) => (
              <ColorPicker value={field.value} onChange={v => { field.onChange(v); setColorPickerOpen(false) }} />
            )} />
          )}
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
              <input {...register('opening_balance')} type="number" step="0.01" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring" placeholder="0.00" />
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

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSubmit(onSubmit)()} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
