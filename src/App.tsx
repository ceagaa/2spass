import { Database, Cloud } from 'lucide-react'
import { VaultProvider, useVault } from './context/VaultContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from './components/Toaster'
import { AuthScreen } from './components/AuthScreen'
import { UnlockScreen } from './components/UnlockScreen'
import { Dashboard } from './components/Dashboard'
import { Logo } from './components/Logo'
import { isLocalMode } from './lib/backend'

function Shell() {
  const { status } = useVault()

  if (status === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Logo size="lg" />
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      {isLocalMode && <LocalModeBanner />}
      {status === 'signed-out' ? (
        <AuthScreen />
      ) : status === 'locked' ? (
        <UnlockScreen />
      ) : (
        <Dashboard />
      )}
    </>
  )
}

/**
 * Shown when no Supabase credentials are present (or VITE_LOCAL_MODE=1).
 * The app is fully functional — accounts and encrypted vaults live in this
 * browser's IndexedDB. Add .env.local to switch to the production backend.
 */
function LocalModeBanner() {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-line bg-elevated/95 px-3 py-1.5 text-xs text-ink-secondary shadow-lg backdrop-blur">
        <Database size={13} className="text-brand" />
        <span>
          <strong className="font-medium text-ink">Modo local</strong> · dados salvos só neste
          navegador
        </span>
        <span className="hidden items-center gap-1 text-ink-tertiary sm:flex">
          <Cloud size={12} className="opacity-50" />
          <span>sem Supabase</span>
        </span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <VaultProvider>
          <Shell />
          <Toaster />
        </VaultProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
