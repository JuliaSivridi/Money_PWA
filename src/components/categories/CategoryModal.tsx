import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColorPicker } from '@/components/common/ColorPicker'
import { IconPicker } from '@/components/common/IconPicker'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { useCategoriesStore } from '@/store/categoriesStore'
import type { Category } from '@/types/category'

interface FormValues {
  name: string
  icon: string
  color: string
  is_expense: boolean
  expense_limit: string
  is_income: boolean
  income_limit: string
}

interface Props {
  open: boolean
  editing?: Category | null
  onClose: () => void
}

export function CategoryModal({ open, editing, onClose }: Props) {
  const { addCategory, updateCategory, deleteCategory, categories } = useCategoriesStore()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [transferTo, setTransferTo] = useState('')

  const { register, handleSubmit, control, reset, watch, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: '', icon: 'Tag', color: '#6b7280', is_expense: true, expense_limit: '', is_income: false, income_limit: '' },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        name: editing.name, icon: editing.icon, color: editing.color,
        is_expense: editing.is_expense, expense_limit: editing.expense_limit ? String(editing.expense_limit) : '',
        is_income: editing.is_income, income_limit: editing.income_limit ? String(editing.income_limit) : '',
      })
    } else {
      reset({ name: '', icon: 'Tag', color: '#6b7280', is_expense: true, expense_limit: '', is_income: false, income_limit: '' })
    }
    setIconPickerOpen(false)
    setColorPickerOpen(false)
  }, [open, editing, reset])

  const watchIcon = watch('icon')
  const watchColor = watch('color')
  const watchExpense = watch('is_expense')
  const watchIncome = watch('is_income')

  const onSubmit = async (values: FormValues) => {
    const input = {
      name: values.name,
      icon: values.icon,
      color: values.color,
      is_expense: values.is_expense,
      expense_limit: parseFloat(values.expense_limit) || 0,
      is_income: values.is_income,
      income_limit: parseFloat(values.income_limit) || 0,
      sort_order: editing?.sort_order ?? 0,
    }
    if (editing) {
      await updateCategory(editing.id, input)
    } else {
      await addCategory(input)
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    await deleteCategory(editing.id, transferTo)
    setConfirmDelete(false)
    onClose()
  }

  const otherCategories = categories.filter(c => c.id !== editing?.id)

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Icon + Color preview */}
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => { setIconPickerOpen(!iconPickerOpen); setColorPickerOpen(false) }} className="focus:outline-none">
                <CategoryIcon icon={watchIcon} color={watchColor} size={24} />
              </button>
              <button type="button" onClick={() => { setColorPickerOpen(!colorPickerOpen); setIconPickerOpen(false) }}
                className="w-8 h-8 rounded-full border-2 border-border"
                style={{ backgroundColor: watchColor }}
              />
              <span className="text-sm text-muted-foreground">Tap to change icon / color</span>
            </div>

            {iconPickerOpen && (
              <Controller name="icon" control={control} render={({ field }) => (
                <IconPicker value={field.value} onChange={(v) => { field.onChange(v); setIconPickerOpen(false) }} />
              )} />
            )}
            {colorPickerOpen && (
              <Controller name="color" control={control} render={({ field }) => (
                <ColorPicker value={field.value} onChange={(v) => { field.onChange(v); setColorPickerOpen(false) }} />
              )} />
            )}

            <div>
              <Label>Name</Label>
              <input {...register('name')} className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="Category name" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Controller name="is_expense" control={control} render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} id="is_expense" className="w-4 h-4" />
                )} />
                <Label htmlFor="is_expense">Expense</Label>
              </div>
              {watchExpense && (
                <div>
                  <Label>Monthly limit (0 = none)</Label>
                  <input {...register('expense_limit')} type="number" min="0" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="0" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Controller name="is_income" control={control} render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} id="is_income" className="w-4 h-4" />
                )} />
                <Label htmlFor="is_income">Income</Label>
              </div>
              {watchIncome && (
                <div>
                  <Label>Monthly limit (0 = none)</Label>
                  <input {...register('income_limit')} type="number" min="0" className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background" placeholder="0" />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row items-center">
            {editing && (
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} className="mr-auto">Delete</Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void handleSubmit(onSubmit)()} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete with transfer dialog */}
      <Dialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Move transactions in this category to:</p>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {otherCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={!transferTo}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
