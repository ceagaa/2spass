import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PasswordInput } from './PasswordInput'
import type { VaultCredential } from '../lib/types'
import { newCredential } from '../lib/vault'

interface CredentialFormModalProps {
  open: boolean
  credential: VaultCredential | null
  itemName: string
  onClose: () => void
  onSave: (credential: VaultCredential) => void
}

export function CredentialFormModal({
  open,
  credential,
  itemName,
  onClose,
  onSave,
}: CredentialFormModalProps) {
  const [draft, setDraft] = useState<VaultCredential>(() => credential ?? newCredential())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(credential ?? newCredential())
      setError(null)
    }
  }, [open, credential])

  function submit() {
    if (!draft.label.trim()) {
      setError('O identificador é obrigatório.')
      return
    }
    onSave({ ...draft, label: draft.label.trim() })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={credential ? 'Editar senha' : 'Adicionar senha'}
      description={`Credencial dentro de “${itemName}”. Tudo é criptografado localmente.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          name="credential-label"
          label="Identificador"
          placeholder="Ex.: Admin, Conta pessoal, API Key…"
          autoFocus
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <Input
          name="credential-username"
          label="Usuário / E-mail"
          autoComplete="off"
          placeholder="voce@exemplo.com"
          value={draft.username}
          onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
        />

        <PasswordInput
          value={draft.password}
          onChange={(password) => setDraft((d) => ({ ...d, password }))}
        />

        <Input
          name="credential-url"
          label="URL (opcional)"
          autoComplete="off"
          placeholder="https://…"
          value={draft.url}
          onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        />

        <div>
          <label htmlFor="credential-notes" className="label-base">
            Notas
          </label>
          <textarea
            id="credential-notes"
            rows={4}
            className="input-base resize-none"
            placeholder="Informações adicionais, PIN, chave de recuperação…"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
