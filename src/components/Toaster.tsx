import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const

const COLORS = {
  success: 'text-success',
  error: 'text-danger-strong',
  info: 'text-ink-secondary',
} as const

export function Toaster() {
  const { toasts } = useToast()
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-elevated p-3.5 shadow-xl backdrop-blur animate-fade-in"
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${COLORS[t.variant]}`} />
            <p className="text-sm text-ink-secondary">{t.message}</p>
          </div>
        )
      })}
    </div>
  )
}
