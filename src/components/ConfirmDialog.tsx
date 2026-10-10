import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  /** Exact text the user must type to unlock the confirm button (double confirmation). */
  requireText?: string
  fieldLabel?: string
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  requireText,
  fieldLabel = 'Digite para confirmar',
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue('')
  }, [open])

  const matches =
    !requireText || value.trim().toLowerCase() === requireText.trim().toLowerCase()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!matches}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-secondary">{message}</p>

      {requireText && (
        <div className="mt-4">
          <div className="mb-3 flex items-start gap-2.5 rounded-md border border-danger-line bg-danger-soft p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-xs leading-relaxed text-danger">
              Esta ação é permanente e não pode ser desfeita.
            </p>
          </div>

          <label htmlFor="confirm-text" className="label-base">
            {fieldLabel}
          </label>
          <input
            id="confirm-text"
            type="text"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={requireText}
            className="input-base"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches) {
                e.preventDefault()
                onConfirm()
                onClose()
              }
            }}
          />
          <p className="mt-1.5 text-xs text-ink-tertiary">
            Digite <strong className="text-ink-secondary">{requireText}</strong> para liberar a
            exclusão.
          </p>
        </div>
      )}
    </Modal>
  )
}
