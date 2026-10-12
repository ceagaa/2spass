import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../context/ToastContext'

/**
 * Registra o service worker em modo autoUpdate: quando uma nova versão fica
 * pronta, o SW assume sozinho e a página recarrega — sem banner de atualização.
 */
export function PwaUpdater() {
  const { toast } = useToast()
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({ immediate: true })

  useEffect(() => {
    if (!offlineReady) return
    toast('2sPass pronto para funcionar offline.', 'success')
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, toast])

  return null
}
