import { useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../context/ToastContext'

/**
 * Registra o service worker e, quando uma nova versão estiver pronta,
 * mostra um aviso para o usuário escolher o momento da atualização
 * (em vez de recarregar a página sozinho e derrubar a sessão).
 */
export function PwaUpdater() {
  const { toast } = useToast()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  useEffect(() => {
    if (!offlineReady) return
    toast('2sPass pronto para funcionar offline.', 'success')
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, toast])

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="top-safe fixed left-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 animate-fade-in"
    >
      <div className="flex items-center gap-3 rounded-full border border-line bg-elevated/95 px-3.5 py-2 shadow-xl backdrop-blur">
        <RefreshCw size={14} className="shrink-0 text-brand" />
        <p className="min-w-0 flex-1 truncate text-xs text-ink-secondary">
          Nova versão do 2sPass disponível
        </p>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-600"
        >
          Atualizar
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Dispensar aviso de atualização"
          className="shrink-0 rounded-full p-1 text-ink-tertiary transition hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
