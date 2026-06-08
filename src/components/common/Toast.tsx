import { useEffect } from 'react'

interface ToastProps {
  message: string
  onDone: () => void
  duration?: number
}

export function Toast({ message, onDone, duration = 2800 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-foreground text-background rounded-[10px] px-5 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 whitespace-nowrap">
      {message}
    </div>
  )
}
