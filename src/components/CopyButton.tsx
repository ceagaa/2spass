import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { CLIPBOARD_CLEAR_MS, copyWithAutoClear } from '../lib/clipboard'
import { useToast } from '../context/ToastContext'

interface CopyButtonProps {
  value: string
  label: string
  className?: string
  size?: number
}

/** Copy-to-clipboard with visible feedback and an automatic 30s clipboard wipe. */
export function CopyButton({ value, label, className = '', size = 16 }: CopyButtonProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const countdown = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (countdown.current) window.clearInterval(countdown.current)
    }
  }, [])

  async function onCopy() {
    try {
      await copyWithAutoClear(value, `entry:${label}`)
      setCopied(true)
      setRemaining(Math.round(CLIPBOARD_CLEAR_MS / 1000))
      if (countdown.current) window.clearInterval(countdown.current)
      countdown.current = window.setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            if (countdown.current) window.clearInterval(countdown.current)
            setCopied(false)
            return 0
          }
          return r - 1
        })
      }, 1000)
      toast('Copiado — será apagado da área de transferência em 30s.', 'success')
    } catch {
      toast('Não foi possível copiar.', 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      aria-label={copied ? `Copiado, limpa em ${remaining}s` : label}
      title={copied ? `Copiado · limpa em ${remaining}s` : label}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition',
        copied
          ? 'bg-success-soft text-success'
          : 'text-ink-tertiary hover:bg-hover/[0.06] hover:text-ink',
        className,
      ].join(' ')}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
      {copied && <span>{remaining}s</span>}
    </button>
  )
}
