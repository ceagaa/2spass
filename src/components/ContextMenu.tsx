import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { MoreVertical } from 'lucide-react'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  label: string
  align?: 'start' | 'end'
  className?: string
  triggerClassName?: string
}

export function ContextMenu({
  items,
  label,
  align = 'end',
  className = '',
  triggerClassName = '',
}: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)

  const close = useCallback((focusTrigger = false) => {
    setOpen(false)
    setPos(null)
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const menu = menuRef.current?.getBoundingClientRect()
    if (!menu) {
      setPos({ top: rect.bottom + 4, left: align === 'end' ? rect.right - 176 : rect.left })
      return
    }
    let top = rect.bottom + 4
    if (top + menu.height > window.innerHeight - 8) top = rect.top - menu.height - 4
    top = Math.max(8, Math.min(top, window.innerHeight - menu.height - 8))
    let left = align === 'end' ? rect.right - menu.width : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - menu.width - 8))
    setPos((current) =>
      current && current.top === top && current.left === left ? current : { top, left },
    )
  }, [align])

  // Posição inicial assim que o menu abre; depois acompanha scroll/resize.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    reposition()
  }, [open, reposition])

  useLayoutEffect(() => {
    if (open) reposition()
  })

  useEffect(() => {
    if (!open) {
      focusedRef.current = false
      return
    }
    if (!pos || focusedRef.current) return
    focusedRef.current = true
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open, pos])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, close, reposition])

  function onMenuKeyDown(event: ReactKeyboardEvent) {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    )
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      nodes[(index + delta + nodes.length) % nodes.length]?.focus()
    } else if (event.key === 'Tab') {
      close()
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={`rounded-md text-ink-tertiary transition hover:bg-hover/[0.06] hover:text-ink ${
          /\bp-/.test(triggerClassName) ? '' : 'p-2'
        } ${triggerClassName}`}
      >
        <MoreVertical size={17} />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 min-w-[176px] rounded-md border border-line bg-elevated p-1 shadow-2xl animate-fade-in"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                close(true)
                item.onSelect()
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition ${
                item.danger
                  ? 'text-danger hover:bg-danger-soft'
                  : 'text-ink-secondary hover:bg-hover/[0.06] hover:text-ink'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
