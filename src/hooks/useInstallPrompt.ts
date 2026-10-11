import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const IOS_UA = /iphone|ipad|ipod/i

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)')
    const readStandalone = () =>
      mode.matches || (navigator as NavigatorWithStandalone).standalone === true

    setStandalone(readStandalone())

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setStandalone(true)
    }
    const onModeChange = (event: MediaQueryListEvent) => setStandalone(event.matches)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    mode.addEventListener('change', onModeChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      mode.removeEventListener('change', onModeChange)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setDeferred(null)
  }, [deferred])

  const isIOS = IOS_UA.test(navigator.userAgent) && !standalone

  return {
    standalone,
    canInstall: Boolean(deferred) && !standalone,
    showIOSHint: isIOS && !deferred,
    install,
  }
}
