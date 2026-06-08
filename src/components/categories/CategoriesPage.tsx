import { useState } from 'react'
import { Plus, Tag, GripVertical } from 'lucide-react'
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
import type { Category } from '@/types/category'

function SortableCategory({ category, onClick }: { category: Category; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 bg-background">
      <button {...attributes} {...listeners} className="text-muted-foreground cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </button>

      <CategoryIcon icon={category.icon} color={category.color} />

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{category.name}</span>
        {category.is_expense && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100/60 text-rose-700/80 dark:bg-rose-900/30 dark:text-rose-300/70 whitespace-nowrap">
            {category.expense_limit > 0 ? `Exp ${category.expense_limit}` : 'Expense'}
          </span>
        )}
        {category.is_income && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100/60 text-emerald-700/80 dark:bg-emerald-900/30 dark:text-emerald-300/70 whitespace-nowrap">
            {category.income_limit > 0 ? `Inc ${category.income_limit}` : 'Income'}
          </span>
        )}
      </div>

      <button onClick={onClick} className="text-muted-foreground hover:text-foreground p-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  )
}

export function CategoriesPage() {
  const { categories, reorder } = useCategoriesStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
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
                <SortableCategory key={cat.id} category={cat} onClick={() => setEditCategory(cat)} />
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
