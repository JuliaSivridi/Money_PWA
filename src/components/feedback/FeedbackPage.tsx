import { useState } from 'react'
import { Send } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Toast } from '@/components/common/Toast'

const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL as string | undefined

export function FeedbackPage() {
  const { user } = useAuthStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim() || sending || !FEEDBACK_URL) return

    setSending(true)
    try {
      const body = new URLSearchParams()
      body.append('app', 'Money')
      body.append('email', user?.email ?? '')
      body.append('message', message.trim())

      await fetch(FEEDBACK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      setToast('Thank you! Your feedback has been sent.')
      setMessage('')
    } catch {
      setToast('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto flex flex-col gap-3.5">
          {!FEEDBACK_URL ? (
            <p className="text-sm text-muted-foreground">Feedback is not configured yet.</p>
          ) : (
            <>
              <p className="text-[0.95rem] text-muted-foreground">
                Have a suggestion or found a bug? Let us know — we read every message.
              </p>
              <textarea
                className="w-full min-h-[130px] rounded-xl bg-card border border-border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                placeholder="Your message…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="self-start flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium px-4 py-2 rounded-[10px] transition-colors"
              >
                <Send size={14} />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
