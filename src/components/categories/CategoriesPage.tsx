import { useState } from 'react'
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
import { usePrefsStore } from '@/store/prefsStore'
import { formatAmount } from '@/utils/currencyUtils'
import type { Category } from '@/types/category'

type ActiveTab = 'expenses' | 'income'

function SortableCategory({ category, onClick, currency }: {
  category: Category
  onClick: () => void
  currency: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const limit = category.expense_limit ?? 0

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 border-b last:border-0 bg-background text-left hover:bg-accent transition-colors"
    >
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
      {limit > 0 && (
        <span className="text-sm text-muted-foreground shrink-0">
          {formatAmount(limit, currency)}/mo
        </span>
      )}
    </button>
  )
}

export function CategoriesPage() {
  const { categories, reorder } = useCategoriesStore()
  const { baseCurrency } = usePrefsStore()
  const [createOpen, setCreateOpen]     = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [activeTab, setActiveTab]       = useState<ActiveTab>('expenses')

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
    await reorder(arrayMove(categories, oldIdx, newIdx).map(c => c.id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toggle tabs with total limit */}
      <div className="flex items-center px-4 py-3 border-b shrink-0">
        <div
          className="flex rounded-lg p-1 gap-1 flex-1"
          style={{ background: 'var(--surface-2, hsl(var(--muted)))' }}
        >
          {(['expenses', 'income'] as ActiveTab[]).map(tab => {
            const isActive = activeTab === tab
            const limit = tab === 'expenses'
              ? categories.filter(c => c.is_expense).reduce((s, c) => s + (c.expense_limit ?? 0), 0)
              : categories.filter(c => c.is_income).reduce((s, c) => s + (c.expense_limit ?? 0), 0)
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="capitalize">{tab}</span>
                {limit > 0 && (
                  <span className="text-muted-foreground font-normal text-xs">
                    {formatAmount(limit, baseCurrency)}/mo
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category list */}
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
                  currency={baseCurrency}
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
