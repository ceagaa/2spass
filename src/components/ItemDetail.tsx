import { useState } from 'react'
import { Folder, Info, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { VaultCredential, VaultItem } from '../lib/types'
import { CredentialRow } from './CredentialRow'
import { CredentialDetailModal } from './CredentialDetailModal'

interface ItemDetailProps {
  item: VaultItem
  groupName: string | null
  onEditItem: () => void
  onDeleteItem: () => void
  onToggleFavorite: () => void
  onAddCredential: () => void
  onEditCredential: (credential: VaultCredential) => void
  onDeleteCredential: (credential: VaultCredential) => void
  onClose: () => void
}

export function ItemDetail({
  item,
  groupName,
  onEditItem,
  onDeleteItem,
  onToggleFavorite,
  onAddCredential,
  onEditCredential,
  onDeleteCredential,
  onClose,
}: ItemDetailProps) {
  const [detail, setDetail] = useState<VaultCredential | null>(null)

  const initial = (item.name || '?').trim().charAt(0).toUpperCase()
  const count = item.credentials.length

  return (
    <div className="flex h-full flex-col bg-base">
      <header className="flex items-start gap-4 border-b border-line p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-lg font-semibold text-brand">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-ink">{item.name || 'Sem nome'}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-tertiary">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Folder size={13} />
              {groupName ?? 'Sem grupo'}
            </span>
            <span className="whitespace-nowrap">{count === 1 ? '1 senha' : `${count} senhas`}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={item.favorite ? 'Remover dos favoritos' : 'Favoritar'}
            aria-pressed={item.favorite}
            className={`rounded-md p-2 transition hover:bg-hover/[0.06] ${
              item.favorite ? 'text-brand' : 'text-ink-tertiary hover:text-ink'
            }`}
          >
            <Star size={17} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={onEditItem}
            aria-label="Editar item"
            className="rounded-md p-2 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-ink"
          >
            <Pencil size={17} />
          </button>
          <button
            type="button"
            onClick={onDeleteItem}
            aria-label="Excluir item"
            className="rounded-md p-2 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-danger-strong"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {count === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hover/[0.04] text-ink-tertiary">
              <Plus size={22} />
            </div>
            <p className="text-sm text-ink-secondary">
              Nenhuma senha neste item ainda.
              <br />
              Adicione quantas quiser.
            </p>
            <button
              type="button"
              onClick={onAddCredential}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              <Plus size={16} /> Adicionar senha
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
                Senhas
              </span>
              <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                <Info size={12} /> Clique para abrir os detalhes
              </span>
            </div>

            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {item.credentials.map((credential, index) => (
                <li key={credential.id}>
                  <CredentialRow
                    credential={credential}
                    index={index}
                    onOpen={() => setDetail(credential)}
                  />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onAddCredential}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line py-3 text-sm font-medium text-brand transition hover:border-brand/40 hover:bg-brand/5"
            >
              <Plus size={16} /> Adicionar outra senha
            </button>
          </>
        )}
      </div>

      <div className="border-t border-line p-3 lg:hidden">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-line py-2 text-sm text-ink-secondary transition hover:bg-hover/[0.05]"
        >
          Voltar
        </button>
      </div>

      <CredentialDetailModal
        open={detail !== null}
        credential={detail}
        itemName={item.name || 'Item'}
        onClose={() => setDetail(null)}
        onEdit={() => {
          const credential = detail
          setDetail(null)
          if (credential) onEditCredential(credential)
        }}
        onDelete={() => {
          const credential = detail
          setDetail(null)
          if (credential) onDeleteCredential(credential)
        }}
      />
    </div>
  )
}
