/**
 * Clipboard helpers with guaranteed auto-wipe.
 *
 * After copying, the clipboard is cleared after `CLEAR_AFTER_MS`. The clear only
 * runs if the clipboard still contains the value we wrote, so we never clobber
 * something the user copied in the meantime.
 */

export const CLIPBOARD_CLEAR_MS = 30_000

const timers = new Map<string, number>()

async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

async function writeClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
}

export interface CopyResult {
  clearInMs: number
}

/**
 * Copies `value` and schedules an automatic wipe. Returns the delay until the
 * clipboard is cleared so the UI can show a countdown.
 */
export async function copyWithAutoClear(value: string, key = 'default'): Promise<CopyResult> {
  if (!navigator.clipboard) throw new Error('Área de transferência indisponível neste contexto.')

  cancelAutoClear(key)
  await writeClipboard(value)

  const timer = window.setTimeout(async () => {
    timers.delete(key)
    const current = await readClipboard()
    if (current === value) {
      try {
        await writeClipboard('')
      } catch {
        /* ignore */
      }
    }
  }, CLIPBOARD_CLEAR_MS)

  timers.set(key, timer)
  return { clearInMs: CLIPBOARD_CLEAR_MS }
}

export function cancelAutoClear(key = 'default'): void {
  const existing = timers.get(key)
  if (existing) {
    window.clearTimeout(existing)
    timers.delete(key)
  }
}

/** Immediately wipes scheduled clipboard entries (e.g. on vault lock/logout). */
export async function wipeAllScheduled(): Promise<void> {
  for (const key of Array.from(timers.keys())) cancelAutoClear(key)
}
