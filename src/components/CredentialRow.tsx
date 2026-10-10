import { ChevronRight, KeyRound } from 'lucide-react'
import type { VaultCredential } from '../lib/types'
import { credentialName } from '../lib/vault'

interface CredentialRowProps {
  credential: VaultCredential
  index: number
  onOpen: () => void
}

/** Compact list row — shows only the identifier. Click opens the details. */
export function CredentialRow({ credential, index, onOpen }: CredentialRowProps) {
  const name = credentialName(credential, index)

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Ver detalhes"
      className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-hover/[0.04] focus-visible:bg-hover/[0.04]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-hover/[0.05] text-ink-tertiary transition group-hover:text-brand">
        <KeyRound size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{name}</span>
      <ChevronRight
        size={16}
        className="shrink-0 text-ink-tertiary opacity-0 transition group-hover:opacity-100"
        aria-hidden
      />
    </button>
  )
}
