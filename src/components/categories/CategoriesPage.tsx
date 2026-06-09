import { useState, useMemo } from 'react'
import { Plus, Tag, GripVertical, TrendingDown, TrendingUp } from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CategoryModal } from './CategoryModal'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { useCategoriesStore } from '@/store/categoriesStore'
import { useTransactionsStore } from '@/store/transactionsStore'
import { formatAmount } from '@/utils/currencyUtils'
import { usePrefsStore } from '@/store/prefsStore'
import { todayISO } from '@/utils/dateUtils'
import type { Category } from '@/types/category'

// ── Budget cell ────────────────────────────────────────────────────────────────

function BudgetCell({ spent, limit, currency, active }: {
  spent: number; limit: number; currency: string; active: boolean
}) {
  if (!active) return <div className="w-24" />
  if (limit > 0) {
    const pct = Math.min(spent / limit, 1)
    const over = spent > limit
    return (
      <div className="w-24 shrink-0 text-right">
        <p className={`text-xs font-medium ${over ? 'text-red-400' : 'text-foreground'}`}>
          {formatAmount(spent, currency)}
        </p>
        <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-green-400'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">{formatAmount(limit, currency)}</p>
      </div>
    )
  }
  if (spent > 0) {
    return (
      <div className="w-24 shrink-0 text-right">
        <p className="text-xs text-muted-foreground">{formatAmount(spent, currency)}</p>
      </div>
    )
  }
  return <div className="w-24 shrink-0" />
}

// ── Column header ──────────────────────────────────────────────────────────────

function ColHeader({ children }: { children: React.ReactNode }) {
  return <div className="w-24 shrink-0 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{children}</div>
}

// ── Sortable row ───────────────────────────────────────────────────────────────

function SortableCategory({
  category, onClick, expenseSpent, incomeEarned, currency,
}: {
  category: Category; onClick: () => void
  expenseSpent: number; incomeEarned: number; currency: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 border-b last:border-0 bg-background w-full text-left hover:bg-accent transition-colors"
    >
      <span
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-0.5 shrink-0"
      >
        <GripVertical size={14} />
      </span>

      <CategoryIcon icon={category.icon} color={category.color} size={28} />

      <span className="flex-1 font-medium truncate min-w-0 text-sm">{category.name}</span>

      <BudgetCell
        spent={expenseSpent}
        limit={category.expense_limit}
        currency={currency}
        active={category.is_expense}
      />
      <BudgetCell
        spent={incomeEarned}
        limit={category.income_limit}
        currency={currency}
        active={category.is_income}
      />
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function CategoriesPage() {
  const { categories, reorder } = useCategoriesStore()
  const { transactions } = useTransactionsStore()
  const { baseCurrency } = usePrefsStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)

  const currentMonth = todayISO().slice(0, 7)

  // Monthly per-category totals (in base currency)
  const { expenseByCategory, incomeByCategory, totalExpenses, totalIncome } = useMemo(() => {
    const expenseByCategory: Record<string, number> = {}
    const incomeByCategory: Record<string, number> = {}
    let totalExpenses = 0
    let totalIncome = 0
    for (const t of transactions) {
      if (!t.date.startsWith(currentMonth)) continue
      for (const cid of t.category_ids) {
        if (t.type === 'expense') {
          expenseByCategory[cid] = (expenseByCategory[cid] || 0) + t.amount_base
          totalExpenses += t.amount_base
        } else if (t.type === 'income') {
          incomeByCategory[cid] = (incomeByCategory[cid] || 0) + t.amount_base
          totalIncome += t.amount_base
        }
      }
    }
    return { expenseByCategory, incomeByCategory, totalExpenses, totalIncome }
  }, [transactions, currentMonth])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = categories.findIndex(c => c.id === active.id)
    const newIdx = categories.findIndex(c => c.id === over.id)
    const newOrder = arrayMove(categories, oldIdx, newIdx)
    await reorder(newOrder.map(c => c.id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Monthly summary */}
      <div className="flex gap-px border-b shrink-0">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-rose-500/5">
          <TrendingDown size={14} className="text-red-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expenses this month</p>
            <p className="text-sm font-semibold text-red-400">{formatAmount(totalExpenses, baseCurrency)}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-emerald-500/5">
          <TrendingUp size={14} className="text-green-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Income this month</p>
            <p className="text-sm font-semibold text-green-400">{formatAmount(totalIncome, baseCurrency)}</p>
          </div>
        </div>
      </div>

      {/* Column headers */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20 shrink-0">
          <div className="w-4 shrink-0" />{/* grip placeholder */}
          <div className="w-10 shrink-0" />{/* icon placeholder */}
          <div className="flex-1" />
          <ColHeader>Expense</ColHeader>
          <ColHeader>Income</ColHeader>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Tag size={40} className="opacity-20" />
            <p>No categories yet</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {categories.map(cat => (
                <SortableCategory
                  key={cat.id}
                  category={cat}
                  onClick={() => setEditCategory(cat)}
                  expenseSpent={expenseByCategory[cat.id] || 0}
                  incomeEarned={incomeByCategory[cat.id] || 0}
                  currency={baseCurrency}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
      >
        <Plus size={24} />
      </button>

      <CategoryModal
        open={createOpen || editCategory !== null}
        editing={editCategory}
        onClose={() => { setCreateOpen(false); setEditCategory(null) }}
      />
    </div>
  )
}
