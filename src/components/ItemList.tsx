import { Globe, KeyRound, Plus, Star } from 'lucide-react'
import type { VaultItem } from '../lib/types'
import { CopyButton } from './CopyButton'

interface ItemListProps {
  items: VaultItem[]
  selectedId: string | null
  total: number
  onSelect: (item: VaultItem) => void
  onNew: () => void
  onToggleFavorite: (item: VaultItem) => void
}

function subtitle(item: VaultItem): string {
  const count = item.credentials.length
  const label = count === 1 ? '1 senha' : `${count} senhas`
  const first = item.credentials[0]?.username
  return first ? `${label} · ${first}` : label
}

export function ItemList({
  items,
  selectedId,
  total,
  onSelect,
  onNew,
  onToggleFavorite,
}: ItemListProps) {
  return (
    <div className="flex h-full flex-col border-r border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Itens</h2>
          <p className="text-xs text-ink-tertiary">{total} no total</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          aria-label="Novo item"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2" role="listbox" aria-label="Itens">
        {items.length === 0 && (
          <li className="mt-16 flex flex-col items-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hover/[0.04] text-ink-tertiary">
              <KeyRound size={22} />
            </div>
            <p className="text-sm text-ink-secondary">Nenhum item aqui.</p>
            <button
              type="button"
              onClick={onNew}
              className="text-sm font-medium text-brand transition hover:text-brand-400"
            >
              Criar primeiro item
            </button>
          </li>
        )}

        {items.map((item) => {
          const active = item.id === selectedId
          const hasUrl = item.credentials.some((c) => c.url)
          const firstPassword = item.credentials.find((c) => c.password)?.password
          return (
            <li key={item.id} role="option" aria-selected={active}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(item)
                  }
                }}
                className={`group/item flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition ${
                  active ? 'bg-brand/15' : 'hover:bg-hover/[0.05]'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    active ? 'bg-brand text-white' : 'bg-hover/[0.05] text-ink-tertiary'
                  }`}
                >
                  {hasUrl ? <Globe size={16} /> : <KeyRound size={16} />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.name || 'Sem nome'}</p>
                  <p className="truncate text-xs text-ink-tertiary">{subtitle(item)}</p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(item)
                  }}
                  aria-label={item.favorite ? 'Remover dos favoritos' : 'Favoritar'}
                  aria-pressed={item.favorite}
                  className={`rounded-md p-1.5 transition ${
                    item.favorite
                      ? 'text-brand'
                      : 'text-ink-tertiary opacity-0 group-hover/item:opacity-100 hover:text-brand'
                  }`}
                >
                  <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
                </button>

                {firstPassword && (
                  <span
                    className="opacity-0 transition group-hover/item:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CopyButton value={firstPassword} label="Copiar senha" />
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
