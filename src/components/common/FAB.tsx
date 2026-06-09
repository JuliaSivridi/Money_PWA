import { Plus } from 'lucide-react'

interface Props {
  onClick: () => void
}

/** Floating Action Button — fixed bottom-right, used on every list page */
export function FAB({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
    >
      <Plus size={24} />
    </button>
  )
}
