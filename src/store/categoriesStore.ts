import { create } from 'zustand'
import { db } from '@/services/db'
import { enqueue } from '@/services/offlineQueue'
import { generateId } from '@/utils/uuid'
import { now } from '@/utils/dateUtils'
import type { Category, CategoryInput } from '@/types/category'

interface CategoriesState {
  categories: Category[]
  addCategory: (input: CategoryInput) => Promise<Category>
  updateCategory: (id: string, patch: Partial<CategoryInput>) => Promise<void>
  deleteCategory: (id: string, transferToId: string) => Promise<void>
  reorder: (ids: string[]) => Promise<void>
  upsertMany: (incoming: Category[]) => Promise<void>
  loadFromDb: () => Promise<void>
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],

  addCategory: async (input) => {
    const ts = now()
    const cats = get().categories
    const maxOrder = cats.length > 0 ? Math.max(...cats.map(c => c.sort_order)) : 0
    const category: Category = { ...input, id: generateId('cat'), sort_order: maxOrder + 1, created_at: ts, updated_at: ts }
    await db.categories.add(category)
    await enqueue('category', 'create', category.id, category as unknown as Record<string, unknown>)
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  updateCategory: async (id, patch) => {
    const existing = get().categories.find(c => c.id === id)
    if (!existing) return
    const updated: Category = { ...existing, ...patch, updated_at: now() }
    await db.categories.where('id').equals(id).modify(updated)
    await enqueue('category', 'update', id, updated as unknown as Record<string, unknown>)
    set((s) => ({ categories: s.categories.map(c => c.id === id ? updated : c) }))
  },

  deleteCategory: async (id, transferToId) => {
    // reassign all transactions with this category_id
    const txns = await db.transactions.where('category_id').equals(id).toArray()
    for (const t of txns) {
      const updated = { ...t, category_id: transferToId, updated_at: now() }
      await db.transactions.where('id').equals(t.id).modify(updated)
      await enqueue('transaction', 'update', t.id, updated as unknown as Record<string, unknown>)
    }
    await db.categories.where('id').equals(id).delete()
    set((s) => ({ categories: s.categories.filter(c => c.id !== id) }))
  },

  reorder: async (ids) => {
    const categories = get().categories
    const ts = now()
    const updated = ids.map((id, idx) => {
      const cat = categories.find(c => c.id === id)!
      return { ...cat, sort_order: idx + 1, updated_at: ts }
    })
    await db.categories.bulkPut(updated)
    for (const cat of updated) {
      await enqueue('category', 'update', cat.id, cat as unknown as Record<string, unknown>)
    }
    set({ categories: updated })
  },

  upsertMany: async (incoming) => {
    const existing = await db.categories.toArray()
    const existingMap = new Map(existing.map(c => [c.id, c]))
    const toStore: Category[] = []
    for (const item of incoming) {
      const local = existingMap.get(item.id)
      if (!local || item.updated_at > local.updated_at) toStore.push(item)
    }
    if (toStore.length > 0) await db.categories.bulkPut(toStore)
    const all = await db.categories.toArray()
    set({ categories: all.sort((a, b) => a.sort_order - b.sort_order) })
  },

  loadFromDb: async () => {
    const all = await db.categories.toArray()
    set({ categories: all.sort((a, b) => a.sort_order - b.sort_order) })
  },
}))
