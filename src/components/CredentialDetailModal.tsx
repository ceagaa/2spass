import { useEffect, useState, type ReactNode } from 'react'
import {
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Pencil,
  StickyNote,
  Trash2,
  User,
} from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { CopyButton } from './CopyButton'
import type { VaultCredential } from '../lib/types'

interface CredentialDetailModalProps {
  open: boolean
  credential: VaultCredential | null
  itemName: string
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export function CredentialDetailModal({
  open,
  credential,
  itemName,
  onClose,
  onEdit,
  onDelete,
}: CredentialDetailModalProps) {
  const [reveal, setReveal] = useState(false)

  useEffect(() => {
    setReveal(false)
  }, [credential?.id])

  if (!credential) return null
  const title = credential.label?.trim() || 'Senha'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={itemName}
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={15} /> Excluir
          </Button>
          <Button onClick={onEdit}>
            <Pencil size={15} /> Editar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DetailField
          icon={<User size={14} />}
          label="Usuário / E-mail"
          action={
            credential.username ? <CopyButton value={credential.username} label="Copiar usuário" /> : null
          }
        >
          <span className="break-all text-sm text-ink">
            {credential.username || <span className="text-ink-tertiary">—</span>}
          </span>
        </DetailField>

        <DetailField
          icon={<KeyRound size={14} />}
          label="Senha"
          action={
            credential.password ? (
              <div className="flex items-center gap-0.5">
                <CopyButton value={credential.password} label="Copiar senha" />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
                  className="rounded-md p-1.5 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-ink"
                >
                  {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            ) : null
          }
        >
          <span className="break-all font-mono text-sm text-ink">
            {credential.password
              ? reveal
                ? credential.password
                : '•'.repeat(Math.min(credential.password.length, 24))
              : '—'}
          </span>
        </DetailField>

        {credential.url && (
          <DetailField icon={<ExternalLink size={14} />} label="URL">
            <a
              href={normalizeUrl(credential.url)}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-sm text-brand transition hover:text-brand-400"
            >
              {credential.url}
            </a>
          </DetailField>
        )}

        <DetailField icon={<StickyNote size={14} />} label="Notas">
          <p className="whitespace-pre-wrap break-words text-sm text-ink-secondary">
            {credential.notes || <span className="text-ink-tertiary">—</span>}
          </p>
        </DetailField>
      </div>
    </Modal>
  )
}

function DetailField({
  icon,
  label,
  action,
  children,
}: {
  icon: ReactNode
  label: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-line bg-base p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
          {icon}
          {label}
        </span>
        {action}
      </div>
      {children}
    </section>
  )
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
