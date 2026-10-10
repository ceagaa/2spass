import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface GroupModalProps {
  open: boolean
  mode: 'create' | 'rename'
  parentName?: string | null
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => void
}

export function GroupModal({
  open,
  mode,
  parentName,
  initialName = '',
  onClose,
  onSubmit,
}: GroupModalProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setError(null)
    }
  }, [open, initialName])

  function submit() {
    if (!name.trim()) {
      setError('Informe um nome.')
      return
    }
    onSubmit(name.trim())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={mode === 'create' ? 'Novo grupo' : 'Renomear grupo'}
      description={
        mode === 'create'
          ? parentName
            ? `Será criado dentro de “${parentName}”.`
            : 'Será criado na raiz.'
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>{mode === 'create' ? 'Criar' : 'Salvar'}</Button>
        </>
      }
    >
      <Input
        name="group-name"
        label="Nome do grupo"
        placeholder="Ex.: Projetos, Bancos, Trabalho…"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  )
}
