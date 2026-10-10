import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, Folder, FolderOpen, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import type { GroupNode } from '../lib/vault'
import type { VaultGroup } from '../lib/types'

interface GroupTreeProps {
  tree: GroupNode[]
  totalItems: number
  unfiledCount: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: (parentId: string | null) => void
  onRename: (group: VaultGroup) => void
  onDelete: (group: VaultGroup) => void
}

export function GroupTree({
  tree,
  totalItems,
  unfiledCount,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: GroupTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allExpanded = useMemo(() => {
    const ids: string[] = []
    const walk = (nodes: GroupNode[]) => nodes.forEach((n) => (ids.push(n.group.id), walk(n.children)))
    walk(tree)
    return ids
  }, [tree])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
          Grupos
        </span>
        <div className="flex items-center gap-0.5">
          {allExpanded.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => (prev.size ? new Set() : new Set(allExpanded)))}
              className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-tertiary transition hover:text-ink"
            >
              {expanded.size ? 'Recolher' : 'Expandir'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onCreate(null)}
            aria-label="Novo grupo"
            title="Novo grupo"
            className="rounded-md p-1.5 text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-brand"
          >
            <FolderPlus size={16} />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" aria-label="Navegação de grupos">
        <TreeRow
          active={selectedId === null}
          onClick={() => onSelect(null)}
          icon={<FolderOpen size={16} />}
          label="Todos os itens"
          count={totalItems}
        />

        {tree.map((node) => (
          <GroupBranch
            key={node.group.id}
            node={node}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            selectedId={selectedId}
            onSelect={onSelect}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}

        {unfiledCount > 0 && (
          <TreeRow
            active={selectedId === 'unfiled'}
            onClick={() => onSelect('unfiled')}
            icon={<Folder size={16} />}
            label="Sem grupo"
            count={unfiledCount}
          />
        )}
      </nav>
    </div>
  )
}

interface BranchProps {
  node: GroupNode
  depth: number
  expanded: Set<string>
  toggle: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (parentId: string) => void
  onRename: (group: VaultGroup) => void
  onDelete: (group: VaultGroup) => void
}

function GroupBranch(props: BranchProps) {
  const { node, depth, expanded, toggle, selectedId, onSelect, onCreate, onRename, onDelete } = props
  const { group } = node
  const isOpen = expanded.has(group.id)
  const hasChildren = node.children.length > 0
  const active = selectedId === group.id

  return (
    <div>
      <div
        className={`group/row flex items-center rounded-md pr-1 transition ${
          active ? 'bg-brand/15 text-ink' : 'text-ink-secondary hover:bg-hover/[0.05]'
        }`}
        style={{ paddingLeft: depth * 14 }}
      >
        <button
          type="button"
          onClick={() => toggle(group.id)}
          aria-label={isOpen ? 'Recolher' : 'Expandir'}
          className={`flex h-7 w-6 shrink-0 items-center justify-center text-ink-tertiary transition ${
            hasChildren ? 'hover:text-ink' : 'opacity-0'
          }`}
          tabIndex={hasChildren ? 0 : -1}
        >
          <ChevronRight size={14} className={`transition ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => onSelect(group.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm"
          aria-current={active ? 'true' : undefined}
        >
          {isOpen && hasChildren ? (
            <FolderOpen size={16} className={active ? 'text-brand' : 'text-ink-tertiary'} />
          ) : (
            <Folder size={16} className={active ? 'text-brand' : 'text-ink-tertiary'} />
          )}
          <span className="truncate">{group.name}</span>
        </button>

        <span className="mr-1 text-[11px] tabular-nums text-ink-tertiary">{node.itemCount}</span>

        <div className="flex items-center opacity-0 transition group-hover/row:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onCreate(group.id)}
            aria-label={`Novo subgrupo em ${group.name}`}
            title="Novo subgrupo"
            className="rounded-md p-1 text-ink-tertiary transition hover:text-brand"
          >
            <FolderPlus size={14} />
          </button>
          <button
            type="button"
            onClick={() => onRename(group)}
            aria-label={`Renomear ${group.name}`}
            title="Renomear"
            className="rounded-md p-1 text-ink-tertiary transition hover:text-ink"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(group)}
            aria-label={`Excluir ${group.name}`}
            title="Excluir"
            className="rounded-md p-1 text-ink-tertiary transition hover:text-danger-strong"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isOpen &&
        node.children.map((child) => (
          <GroupBranch key={child.group.id} {...props} node={child} depth={depth + 1} />
        ))}
    </div>
  )
}

interface RowProps {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  count: number
}

function TreeRow({ active, onClick, icon, label, count }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition ${
        active ? 'bg-brand/15 text-ink' : 'text-ink-secondary hover:bg-hover/[0.05]'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      <span className={active ? 'text-brand' : 'text-ink-tertiary'}>{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-[11px] tabular-nums text-ink-tertiary">{count}</span>
    </button>
  )
}
