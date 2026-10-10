import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { VaultGroup, VaultItem } from '../lib/types'
import { newItem } from '../lib/vault'

interface ItemFormModalProps {
  open: boolean
  item: VaultItem | null
  defaultGroupId: string | null
  groups: VaultGroup[]
  onClose: () => void
  onSave: (item: VaultItem) => void
}

interface FlatGroup {
  id: string
  label: string
}

function flattenGroups(groups: VaultGroup[]): FlatGroup[] {
  const childrenOf = new Map<string | null, VaultGroup[]>()
  for (const g of groups) {
    const list = childrenOf.get(g.parentId) ?? []
    list.push(g)
    childrenOf.set(g.parentId, list)
  }
  const out: FlatGroup[] = []
  const walk = (parentId: string | null, depth: number) => {
    const list = (childrenOf.get(parentId) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
    for (const g of list) {
      out.push({ id: g.id, label: `${'— '.repeat(depth)}${g.name}` })
      walk(g.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function ItemFormModal({
  open,
  item,
  defaultGroupId,
  groups,
  onClose,
  onSave,
}: ItemFormModalProps) {
  const [draft, setDraft] = useState<VaultItem>(() => item ?? newItem(defaultGroupId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(item ?? newItem(defaultGroupId))
      setError(null)
    }
  }, [open, item, defaultGroupId])

  const flat = flattenGroups(groups)

  function submit() {
    if (!draft.name.trim()) {
      setError('Informe o nome do item (ex.: Supabase, GitHub).')
      return
    }
    onSave({ ...draft, name: draft.name.trim() })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar item' : 'Novo item'}
      description="Um item agrupa quantas senhas você quiser."
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
          name="item-name"
          label="Nome do item"
          placeholder="Ex.: Supabase, GitHub, Banco…"
          autoFocus
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <div>
          <label htmlFor="item-group" className="label-base">
            Grupo
          </label>
          <select
            id="item-group"
            className="input-base"
            value={draft.groupId ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, groupId: e.target.value ? e.target.value : null }))
            }
          >
            <option value="">Sem grupo</option>
            {flat.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, favorite: !d.favorite }))}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
            draft.favorite
              ? 'border-brand/40 bg-brand/10 text-brand'
              : 'border-line text-ink-secondary hover:bg-hover/[0.05]'
          }`}
          aria-pressed={draft.favorite}
        >
          <Star size={15} fill={draft.favorite ? 'currentColor' : 'none'} />
          {draft.favorite ? 'Nos favoritos' : 'Adicionar aos favoritos'}
        </button>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
