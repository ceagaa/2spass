import { useMemo, useState } from 'react'
import {
  Cloud,
  CloudOff,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { descendantGroupIds, credentialName } from '../lib/vault'
import type { VaultCredential, VaultGroup, VaultItem } from '../lib/types'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { GroupTree } from './GroupTree'
import { ItemList } from './ItemList'
import { ItemDetail } from './ItemDetail'
import { ItemFormModal } from './ItemFormModal'
import { CredentialFormModal } from './CredentialFormModal'
import { GroupModal } from './GroupModal'
import { ConfirmDialog } from './ConfirmDialog'

type GroupModalState =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'rename'; group: VaultGroup }
  | null

interface CredentialModalState {
  itemId: string
  itemName: string
  credential: VaultCredential | null
}

export function Dashboard() {
  const {
    vault,
    tree,
    user,
    syncState,
    isOnline,
    lock,
    signOut,
    addGroup,
    renameGroup,
    removeGroup,
    saveItem,
    removeItem,
    saveCredential,
    removeCredential,
    syncNow,
  } = useVault()
  const { toast } = useToast()

  const [scope, setScope] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [groupModal, setGroupModal] = useState<GroupModalState>(null)
  const [itemModal, setItemModal] = useState<{ item: VaultItem | null; groupId: string | null } | null>(
    null,
  )
  const [credentialModal, setCredentialModal] = useState<CredentialModalState | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    requireText: string
    fieldLabel: string
    confirmLabel: string
    action: () => void
  } | null>(null)

  const items = vault?.items ?? []
  const groups = vault?.groups ?? []

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  )

  const scopedItems = useMemo(() => {
    if (scope === 'unfiled') return items.filter((i) => !i.groupId)
    if (scope === null) return items
    const ids = descendantGroupIds(groups, scope)
    return items.filter((i) => i.groupId && ids.has(i.groupId))
  }, [items, groups, scope])

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? scopedItems.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.credentials.some(
              (c) =>
                c.label.toLowerCase().includes(q) ||
                c.username.toLowerCase().includes(q) ||
                c.url.toLowerCase().includes(q),
            ),
        )
      : scopedItems
    return [...base].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [scopedItems, query])

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groups) map.set(g.id, g.name)
    return map
  }, [groups])

  const scopeLabel =
    scope === null
      ? 'Todos os itens'
      : scope === 'unfiled'
        ? 'Sem grupo'
        : (groupNameById.get(scope) ?? 'Grupo')

  const defaultGroupId = scope && scope !== 'unfiled' ? scope : null

  function openNewItem() {
    setItemModal({ item: null, groupId: defaultGroupId })
  }

  function openNewCredential(item: VaultItem) {
    setCredentialModal({ itemId: item.id, itemName: item.name, credential: null })
  }

  function openEditCredential(item: VaultItem, credential: VaultCredential) {
    setCredentialModal({ itemId: item.id, itemName: item.name, credential })
  }

  function handleDeleteItem(item: VaultItem) {
    const name = item.name || 'Sem nome'
    setConfirm({
      title: 'Excluir item',
      message: `“${name}” e todas as suas ${item.credentials.length} senha(s) serão removidas permanentemente.`,
      requireText: name,
      fieldLabel: 'Digite o nome do item',
      confirmLabel: 'Excluir item',
      action: () => {
        removeItem(item.id)
        setSelectedId(null)
        toast('Item excluído.', 'success')
      },
    })
  }

  function handleDeleteCredential(item: VaultItem, credential: VaultCredential) {
    const index = item.credentials.findIndex((c) => c.id === credential.id)
    const name = credentialName(credential, index >= 0 ? index : undefined)
    setConfirm({
      title: 'Excluir senha',
      message: `“${name}” será removida de “${item.name}” permanentemente.`,
      requireText: name,
      fieldLabel: 'Digite o identificador da senha',
      confirmLabel: 'Excluir senha',
      action: () => {
        removeCredential(item.id, credential.id)
        toast('Senha excluída.', 'success')
      },
    })
  }

  function handleDeleteGroup(group: VaultGroup) {
    setConfirm({
      title: 'Excluir grupo',
      message: `“${group.name}” e todo o seu conteúdo (subgrupos e itens) serão removidos permanentemente.`,
      requireText: group.name,
      fieldLabel: 'Digite o nome do grupo',
      confirmLabel: 'Excluir grupo',
      action: () => {
        removeGroup(group.id)
        if (scope === group.id) setScope(null)
        toast('Grupo excluído.', 'success')
      },
    })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <div>
              <p className="text-sm font-semibold leading-none text-ink">Lock</p>
              <p className="mt-0.5 text-[11px] text-ink-tertiary">Zeró-knowledge</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-ink-tertiary hover:text-ink lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 pt-3">
          <GroupTree
            tree={tree}
            totalItems={items.length}
            unfiledCount={items.filter((i) => !i.groupId).length}
            selectedId={scope}
            onSelect={(id) => {
              setScope(id)
              setSidebarOpen(false)
            }}
            onCreate={(parentId) => setGroupModal({ mode: 'create', parentId })}
            onRename={(group) => setGroupModal({ mode: 'rename', group })}
            onDelete={handleDeleteGroup}
          />
        </div>

        <div className="space-y-1 border-t border-line p-3">
          <SyncBadge syncState={syncState} isOnline={isOnline} onSync={syncNow} />
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
            <span className="truncate text-xs text-ink-tertiary">{user?.email}</span>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={lock}
                aria-label="Bloquear cofre"
                title="Bloquear agora"
                className="rounded-md p-1.5 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-brand"
              >
                <Lock size={15} />
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Sair da conta"
                title="Sair"
                className="rounded-md p-1.5 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-ink"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* List column */}
      <div
        className={`flex min-w-0 flex-1 flex-col lg:w-[360px] lg:flex-none ${
          selectedItem ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-ink lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar em ${scopeLabel}…`}
              aria-label="Buscar itens"
              className="input-base py-2 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <ItemList
            items={visibleItems}
            total={scopedItems.length}
            selectedId={selectedId}
            onSelect={(item) => setSelectedId(item.id)}
            onNew={openNewItem}
            onToggleFavorite={(item) => saveItem({ ...item, favorite: !item.favorite })}
          />
        </div>
      </div>

      {/* Detail column */}
      <div className={`min-w-0 flex-1 ${selectedItem ? 'flex' : 'hidden lg:flex'}`}>
        {selectedItem ? (
          <div className="w-full">
            <ItemDetail
              item={selectedItem}
              groupName={
                selectedItem.groupId ? (groupNameById.get(selectedItem.groupId) ?? null) : null
              }
              onEditItem={() => setItemModal({ item: selectedItem, groupId: selectedItem.groupId })}
              onDeleteItem={() => handleDeleteItem(selectedItem)}
              onToggleFavorite={() =>
                saveItem({ ...selectedItem, favorite: !selectedItem.favorite })
              }
              onAddCredential={() => openNewCredential(selectedItem)}
              onEditCredential={(credential) => openEditCredential(selectedItem, credential)}
              onDeleteCredential={(credential) => handleDeleteCredential(selectedItem, credential)}
              onClose={() => setSelectedId(null)}
            />
          </div>
        ) : (
          <EmptyState onNew={openNewItem} />
        )}
      </div>

      {/* Modals */}
      {groupModal && (
        <GroupModal
          open
          mode={groupModal.mode}
          parentName={
            groupModal.mode === 'create' && groupModal.parentId
              ? (groupNameById.get(groupModal.parentId) ?? null)
              : null
          }
          initialName={groupModal.mode === 'rename' ? groupModal.group.name : ''}
          onClose={() => setGroupModal(null)}
          onSubmit={(name) => {
            if (groupModal.mode === 'create') {
              addGroup(name, groupModal.parentId)
              toast('Grupo criado.', 'success')
            } else {
              renameGroup(groupModal.group.id, name)
              toast('Grupo renomeado.', 'success')
            }
          }}
        />
      )}

      <ItemFormModal
        open={itemModal !== null}
        item={itemModal?.item ?? null}
        defaultGroupId={itemModal?.groupId ?? null}
        groups={groups}
        onClose={() => setItemModal(null)}
        onSave={(item) => {
          saveItem(item)
          setSelectedId(item.id)
          toast(itemModal?.item ? 'Item salvo.' : 'Item criado.', 'success')
        }}
      />

      <CredentialFormModal
        open={credentialModal !== null}
        credential={credentialModal?.credential ?? null}
        itemName={credentialModal?.itemName ?? ''}
        onClose={() => setCredentialModal(null)}
        onSave={(credential) => {
          if (!credentialModal) return
          saveCredential(credentialModal.itemId, credential)
          toast(credentialModal.credential ? 'Senha salva.' : 'Senha adicionada.', 'success')
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Excluir'}
        requireText={confirm?.requireText}
        fieldLabel={confirm?.fieldLabel}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </div>
  )
}

function SyncBadge({
  syncState,
  isOnline,
  onSync,
}: {
  syncState: string
  isOnline: boolean
  onSync: () => void
}) {
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
        <CloudOff size={14} />
        Offline — alterações serão sincronizadas
      </div>
    )
  }
  if (syncState === 'syncing') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-hover/[0.04] px-2.5 py-1.5 text-xs text-ink-secondary">
        <Loader2 size={14} className="animate-spin" /> Sincronizando…
      </div>
    )
  }
  if (syncState === 'error') {
    return (
      <button
        type="button"
        onClick={onSync}
        className="flex w-full items-center gap-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger"
      >
        <RefreshCw size={14} /> Falha ao sincronizar — tentar novamente
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-md bg-success-soft px-2.5 py-1.5 text-xs text-success">
      <Cloud size={14} /> Sincronizado
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <ShieldCheck size={30} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink">Selecione um item</h2>
        <p className="mt-1 max-w-xs text-sm text-ink-secondary">
          Cada item guarda quantas senhas você quiser. Escolha um à esquerda ou crie um novo.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        <Plus size={16} /> Novo item
      </button>
    </div>
  )
}
