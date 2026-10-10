import { useEffect, useRef } from 'react'

interface Options {
  enabled: boolean
  timeoutMs: number
  onLock: () => void
}

const ACTIVITY_EVENTS: (keyof DocumentEventMap | keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'touchmove',
  'scroll',
  'wheel',
  'focus',
]

/**
 * Locks the vault after `timeoutMs` of inactivity.
 *
 * A polling check (instead of a single rescheduled timeout) is used so the lock
 * still fires reliably when background-tab timer throttling kicks in. Activity
 * events only update a timestamp ref, so this is effectively free.
 */
export function useAutoLock({ enabled, timeoutMs, onLock }: Options) {
  const lastActivity = useRef<number>(Date.now())
  const lockRef = useRef(onLock)
  lockRef.current = onLock

  useEffect(() => {
    if (!enabled) return
    lastActivity.current = Date.now()

    const bump = () => {
      lastActivity.current = Date.now()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, bump, { passive: true })
    }

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= timeoutMs) {
        lockRef.current()
      }
    }, 1000)

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, bump)
      }
      window.clearInterval(interval)
    }
  }, [enabled, timeoutMs])
}
