import { useState, useMemo } from 'react'
import { Tag, GripVertical } from 'lucide-react'
import { FAB } from '@/components/common/FAB'
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

type ActiveTab = 'expenses' | 'income'

// ── Sortable row ───────────────────────────────────────────────────────────────

function SortableCategory({
  category, onClick, amount, currency, activeTab,
}: {
  category: Category; onClick: () => void;
  amount: number; currency: string; activeTab: ActiveTab
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const isExpense = activeTab === 'expenses'
  const limit = isExpense ? category.expense_limit : 0
  const hasLimit = limit > 0
  const over = hasLimit && amount > limit
  const pct = hasLimit ? Math.min(amount / limit, 1) : 0

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className="flex flex-col w-full px-3 py-3 border-b last:border-0 bg-background text-left hover:bg-accent transition-colors gap-1"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 w-full">
        <span
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <GripVertical size={14} />
        </span>

        <CategoryIcon icon={category.icon} color={category.color} size={28} />

        <span className="flex-1 font-medium truncate min-w-0">{category.name}</span>

        {amount > 0 && (
          <span className={`font-medium shrink-0 ${over ? 'text-red-400' : isExpense ? 'text-foreground' : 'text-green-400'}`}>
            {formatAmount(amount, currency)}
          </span>
        )}
        {hasLimit && (
          <span className={`text-sm shrink-0 ${over ? 'text-red-400' : 'text-green-400'}`}>
            {over ? '✗' : '✓'} {formatAmount(limit, currency)}
          </span>
        )}
      </div>

      {/* Full-width progress bar — only when limit is set */}
      {hasLimit && (
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-green-400'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('expenses')

  const currentMonth = todayISO().slice(0, 7)

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

  const visibleCategories = categories.filter(c =>
    activeTab === 'expenses' ? c.is_expense : c.is_income
  )

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
      {/* Toggle tabs — both totals always visible */}
      <div className="flex items-center px-4 py-3 border-b shrink-0">
        <div
          className="flex rounded-lg p-1 gap-1 w-full"
          style={{ background: 'var(--surface-2, hsl(var(--muted)))' }}
        >
          {(['expenses', 'income'] as ActiveTab[]).map(tab => {
            const total = tab === 'expenses' ? totalExpenses : totalIncome
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="capitalize">{tab}</span>
                {total > 0 && (
                  <span className={`font-bold ${tab === 'expenses' ? 'text-red-400' : 'text-green-400'}`}>
                    {formatAmount(total, baseCurrency)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {visibleCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Tag size={40} className="opacity-20" />
            <p>No {activeTab} categories yet</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            <SortableContext items={visibleCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {visibleCategories.map(cat => (
                <SortableCategory
                  key={cat.id}
                  category={cat}
                  onClick={() => setEditCategory(cat)}
                  amount={activeTab === 'expenses' ? (expenseByCategory[cat.id] || 0) : (incomeByCategory[cat.id] || 0)}
                  currency={baseCurrency}
                  activeTab={activeTab}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <FAB onClick={() => setCreateOpen(true)} />

      <CategoryModal
        open={createOpen || editCategory !== null}
        editing={editCategory}
        onClose={() => { setCreateOpen(false); setEditCategory(null) }}
      />
    </div>
  )
}
